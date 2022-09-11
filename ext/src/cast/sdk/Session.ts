import { v4 as uuid } from "uuid";

import { Logger } from "../../lib/logger";

import pageMessaging from "../pageMessaging";
import { convertSupportedMediaCommandsFlags } from "../utils";

import type {
    MediaStatus,
    ReceiverMediaMessage,
    SenderMediaMessage,
    SenderMessage
} from "./types";

import { ErrorCode, SessionStatus } from "./enums";
import {
    Error as CastError,
    Image,
    Receiver,
    SenderApplication
} from "./classes";

import type { LoadRequest, QueueLoadRequest, QueueItem } from "./media/classes";
import Media, {
    createMedia,
    MediaLastUpdateTimes,
    MediaUpdateListeners,
    NS_MEDIA
} from "./media/Media";

const logger = new Logger("fx_cast [sdk :: cast.Session]");

/**
 * Takes a media object and a media status object and merges the status
 * with the existing media object, updating it with new properties.
 */
export function updateMedia(media: Media, status: MediaStatus) {
    if (status.currentTime) {
        MediaLastUpdateTimes.set(media, Date.now());
    }

    // Copy basic props
    if (status.currentTime) media.currentTime = status.currentTime;
    if (status.customData) media.customData = status.customData;
    if (status.idleReason) media.idleReason = status.idleReason;
    if (status.media) media.media = status.media;
    if (status.mediaSessionId) media.mediaSessionId = status.mediaSessionId;
    if (status.playbackRate) media.playbackRate = status.playbackRate;
    if (status.playerState) media.playerState = status.playerState;
    if (status.repeatMode) media.repeatMode = status.repeatMode;
    if (status.volume) media.volume = status.volume;

    media.supportedMediaCommands = convertSupportedMediaCommandsFlags(
        status.supportedMediaCommands
    );

    // Update queue state
    if (status.items) {
        const newItems: QueueItem[] = [];

        for (const newItem of status.items) {
            if (!newItem.media) {
                // Existing queue item with the same ID
                const existingItem = media.items?.find(
                    item => item.itemId === newItem.itemId
                );

                /**
                 * Use existing queue item's media info if available
                 * otherwise, if the current queue item, use the main
                 * media item.
                 */
                if (existingItem?.media) {
                    newItem.media = existingItem.media;
                } else if (
                    media.media &&
                    newItem.itemId === media.currentItemId
                ) {
                    newItem.media = media.media;
                }
            }

            newItems.push(newItem);
        }

        media.items = newItems;
    }
}

export const SessionMessageListeners = new WeakMap<
    Session,
    Map<string, Set<MessageListener>>
>();
export const SessionUpdateListeners = new WeakMap<
    Session,
    Set<UpdateListener>
>();
export const SessionSendMessageCallbacks = new WeakMap<
    Session,
    Map<string, SendMessageCallback>
>();

export const SessionLeaveSuccessCallback = new WeakMap<
    Session,
    Optional<() => void>
>();

type SendMediaMessage = (
    message: DistributiveOmit<SenderMediaMessage, "requestId">
) => Promise<void>;
export const SessionSendMediaMessage = new WeakMap<Session, SendMediaMessage>();

/** Creates a Session object and initializes private data. */
export function createSession(
    sessionArgs: ConstructorParameters<typeof Session>
) {
    const session = new Session(...sessionArgs);
    SessionUpdateListeners.set(session, new Set());
    SessionSendMessageCallbacks.set(session, new Map());

    SessionSendMediaMessage.set(session, message => {
        return new Promise<void>((resolve, reject) => {
            session.sendMessage(
                NS_MEDIA,
                { ...message, requestId: 0 },
                resolve,
                reject
            );
        });
    });

    return session;
}

type MessageListener = (namespace: string, message: string) => void;
type UpdateListener = (isAlive: boolean) => void;
type SendMessageCallback = [(() => void)?, ((err: CastError) => void)?];

export default class Session {
    #loadMediaRequest?: LoadRequest;
    #loadMediaSuccessCallback?: (media: Media) => void;
    #loadMediaErrorCallback?: (err: CastError) => void;

    get #messageListeners() {
        const messageListeners = SessionMessageListeners.get(this);
        if (!messageListeners)
            throw logger.error("Missing session message listeners!");
        return messageListeners;
    }
    get #updateListeners() {
        const updateListeners = SessionUpdateListeners.get(this);
        if (!updateListeners)
            throw logger.error("Missing session update listeners!");
        return updateListeners;
    }
    get #sendMessageCallbacks() {
        const sendMessageCallback = SessionSendMessageCallbacks.get(this);
        if (!sendMessageCallback)
            throw logger.error("Missing session sendMessage callback!");
        return sendMessageCallback;
    }

    get #sendMediaMessage() {
        const sendMediaMessage = SessionSendMediaMessage.get(this);
        if (!sendMediaMessage)
            throw logger.error("Missing send media message function!");
        return sendMediaMessage;
    }

    get #leaveSuccessCallback() {
        return SessionLeaveSuccessCallback.get(this);
    }
    set #leaveSuccessCallback(successCallback: Optional<() => void>) {
        SessionLeaveSuccessCallback.set(this, successCallback);
    }

    media: Media[] = [];
    namespaces: Array<{ name: string }> = [];
    senderApps: SenderApplication[] = [];
    status = SessionStatus.CONNECTED;
    statusText: Nullable<string> = null;
    transportId: string;

    constructor(
        public sessionId: string,
        public appId: string,
        public displayName: string,
        public appImages: Image[],
        public receiver: Receiver
    ) {
        this.transportId = sessionId || "";

        SessionMessageListeners.set(this, new Map());
        this.addMessageListener(NS_MEDIA, this.#mediaMessageListener);
    }

    #mediaMessageListener = (namespace: string, messageString: string) => {
        if (namespace !== NS_MEDIA) return;

        const message: ReceiverMediaMessage = JSON.parse(messageString);
        switch (message.type) {
            case "MEDIA_STATUS": {
                // Update media
                for (const mediaStatus of message.status) {
                    let media = this.media.find(
                        media =>
                            media.mediaSessionId === mediaStatus.mediaSessionId
                    );

                    // Handle Media creation
                    if (!media) {
                        media = createMedia(
                            [this.sessionId, mediaStatus.mediaSessionId],
                            this.#sendMediaMessage
                        );

                        this.media.push(media);
                        updateMedia(media, mediaStatus);
                        this.#loadMediaSuccessCallback?.(media);
                    } else {
                        updateMedia(media, mediaStatus);
                        const updateListeners = MediaUpdateListeners.get(media);
                        if (updateListeners) {
                            for (const listener of updateListeners) {
                                listener(true);
                            }
                        }
                    }
                }
            }
        }
    };

    #sendReceiverMessage = (
        message: DistributiveOmit<SenderMessage, "requestId">
    ) => {
        return new Promise<void>((resolve, reject) => {
            const messageId = uuid();

            pageMessaging.page.sendMessage({
                subject: "bridge:sendCastReceiverMessage",
                data: {
                    sessionId: this.sessionId,
                    messageData: message as SenderMessage,
                    messageId
                }
            });

            this.#sendMessageCallbacks.set(messageId, [resolve, reject]);
        });
    };

    addMediaListener(_mediaListener: (media: Media) => void) {
        logger.info("STUB :: Session#addMediaListener");
    }
    removeMediaListener(_mediaListener: (media: Media) => void) {
        logger.info("STUB :: Session#removeMediaListener");
    }

    addMessageListener(namespace: string, listener: MessageListener) {
        if (!this.#messageListeners.has(namespace)) {
            this.#messageListeners.set(namespace, new Set());
        }

        this.#messageListeners.get(namespace)?.add(listener);
    }
    removeMessageListener(namespace: string, listener: MessageListener) {
        this.#messageListeners.get(namespace)?.delete(listener);
    }

    addUpdateListener(listener: UpdateListener) {
        this.#updateListeners.add(listener);
    }
    removeUpdateListener(listener: UpdateListener) {
        this.#updateListeners.delete(listener);
    }

    leave(
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        if (!this.sessionId) {
            errorCallback?.(
                new CastError(ErrorCode.INVALID_PARAMETER, "Session not active")
            );
            return;
        }

        this.#leaveSuccessCallback = successCallback;

        pageMessaging.page.sendMessage({
            subject: "main:leaveSession"
        });
    }

    loadMedia(
        loadRequest: LoadRequest,
        successCallback?: (media: Media) => void,
        errorCallback?: (err: CastError) => void
    ) {
        if (!loadRequest) {
            errorCallback?.(new CastError(ErrorCode.INVALID_PARAMETER));
            return;
        }

        this.#loadMediaSuccessCallback = successCallback;
        this.#loadMediaErrorCallback = errorCallback;

        loadRequest.sessionId = this.sessionId;
        this.#sendMediaMessage(loadRequest).catch(errorCallback);
    }

    queueLoad(
        _queueLoadRequest: QueueLoadRequest,
        _successCallback?: (media: Media) => void,
        _errorCallback?: (err: CastError) => void
    ) {
        logger.info("STUB :: Session#queueLoad");
    }

    sendMessage(
        namespace: string,
        message: object | string,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        const messageId = uuid();

        pageMessaging.page.sendMessage({
            subject: "bridge:sendCastSessionMessage",
            data: {
                sessionId: this.sessionId,
                namespace,
                messageData: message,
                messageId
            }
        });

        this.#sendMessageCallbacks.set(messageId, [
            successCallback,
            errorCallback
        ]);
    }

    setReceiverMuted(
        muted: boolean,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        this.#sendReceiverMessage({ type: "SET_VOLUME", volume: { muted } })
            .then(successCallback)
            .catch(errorCallback);
    }

    setReceiverVolumeLevel(
        newLevel: number,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        this.#sendReceiverMessage({
            type: "SET_VOLUME",
            volume: { level: newLevel }
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    stop(
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        this.#sendReceiverMessage({ type: "STOP", sessionId: this.sessionId })
            .then(successCallback)
            .catch(errorCallback);
    }
}
