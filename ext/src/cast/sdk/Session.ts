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

import { PlayerState } from "./media/enums";
import type { LoadRequest, QueueLoadRequest, QueueItem } from "./media/classes";
import Media, {
    createMedia,
    mediaLastUpdateTimes,
    mediaUpdateListeners,
    NS_MEDIA
} from "./media/Media";

const logger = new Logger("fx_cast [sdk :: cast.Session]");

/**
 * Takes a media object and a media status object and merges the status
 * with the existing media object, updating it with new properties.
 */
export function updateMedia(media: Media, status: MediaStatus) {
    media.currentItemId = null;
    media.loadingItemId = null;
    media.preloadedItemId = null;

    // Copy status properties to media
    for (const prop in status) {
        if (prop === "items") continue;

        switch (prop) {
            case "volume":
                media.volume.level = status.volume.level;
                media.volume.muted = status.volume.muted;
                break;
            case "supportedMediaCommands":
                media.supportedMediaCommands =
                    convertSupportedMediaCommandsFlags(
                        status.supportedMediaCommands
                    );
                break;

            default:
                (media as any)[prop] = (status as any)[prop];
        }
    }

    if (!("idleReason" in status)) {
        media.idleReason = null;
    }
    if (!("extendedStatus" in status)) {
        // FIXME: Add extendedStatus types
        (media as any).extendedStatus = null;
    }

    // Set last update time on currentTime change
    if ("currentTime" in status) {
        mediaLastUpdateTimes.set(media, Date.now());
    }

    if (
        media.playerState === PlayerState.IDLE &&
        media.loadingItemId === null
    ) {
        media.currentItemId = null;
        media.loadingItemId = null;
        media.preloadedItemId = null;
        media.items = null;
    } else if (status.items) {
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

export const sessionMessageListeners = new WeakMap<
    Session,
    Map<string, Set<MessageListener>>
>();
export const sessionUpdateListeners = new WeakMap<
    Session,
    Set<UpdateListener>
>();
export const sessionSendMessageCallbacks = new WeakMap<
    Session,
    Map<string, SendMessageCallback>
>();

export const sessionLeaveSuccessCallback = new WeakMap<
    Session,
    Optional<() => void>
>();

type SendMediaMessage = (
    message: DistributiveOmit<SenderMediaMessage, "requestId">
) => Promise<void>;
export const sessionSendMediaMessage = new WeakMap<Session, SendMediaMessage>();

interface MediaRequest {
    successCallback: () => void;
    errorCallback: (error: CastError) => void;
    message: SenderMediaMessage;
    requestId: number;
}

const sessionMediaRequests = new WeakMap<Session, Map<number, MediaRequest>>();

/** Creates a Session object and initializes private data. */
export function createSession(
    sessionArgs: ConstructorParameters<typeof Session>
) {
    const session = new Session(...sessionArgs);
    sessionUpdateListeners.set(session, new Set());
    sessionSendMessageCallbacks.set(session, new Map());

    // Record of pending media requests
    // FIXME: Handle request timeouts
    const mediaRequests = new Map<number, MediaRequest>();
    sessionMediaRequests.set(session, mediaRequests);

    // Current media request ID
    let mediaRequestId = 1;

    /**
     * Stores callbacks for request response, then adds current request
     * ID to the message and sends it.
     */
    sessionSendMediaMessage.set(session, message => {
        return new Promise<void>((resolve, reject) => {
            const requestId = mediaRequestId++;
            const request: MediaRequest = {
                successCallback: () => {
                    mediaRequests.delete(requestId);
                    resolve();
                },
                errorCallback: () => {
                    mediaRequests.delete(requestId);
                    reject();
                },
                message: { ...message, requestId },
                requestId
            };

            mediaRequests.set(request.requestId, request);
            session.sendMessage(NS_MEDIA, request.message, undefined, () => {
                mediaRequests.delete(requestId);
                reject();
            });
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
        const messageListeners = sessionMessageListeners.get(this);
        if (!messageListeners)
            throw logger.error("Missing session message listeners!");
        return messageListeners;
    }
    get #updateListeners() {
        const updateListeners = sessionUpdateListeners.get(this);
        if (!updateListeners)
            throw logger.error("Missing session update listeners!");
        return updateListeners;
    }
    get #sendMessageCallbacks() {
        const sendMessageCallback = sessionSendMessageCallbacks.get(this);
        if (!sendMessageCallback)
            throw logger.error("Missing session sendMessage callback!");
        return sendMessageCallback;
    }

    get #sendMediaMessage() {
        const sendMediaMessage = sessionSendMediaMessage.get(this);
        if (!sendMediaMessage)
            throw logger.error("Missing send media message function!");
        return sendMediaMessage;
    }

    get #mediaRequests() {
        const mediaRequests = sessionMediaRequests.get(this);
        if (!mediaRequests)
            throw logger.error("Missing session media requests!");
        return mediaRequests;
    }

    get #leaveSuccessCallback() {
        return sessionLeaveSuccessCallback.get(this);
    }
    set #leaveSuccessCallback(successCallback: Optional<() => void>) {
        sessionLeaveSuccessCallback.set(this, successCallback);
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

        sessionMessageListeners.set(this, new Map());
        this.addMessageListener(NS_MEDIA, this.#mediaMessageListener);
    }

    #mediaMessageListener = (namespace: string, messageString: string) => {
        if (namespace !== NS_MEDIA) return;
        const message: ReceiverMediaMessage = JSON.parse(messageString);
        if (message.type !== "MEDIA_STATUS") return;

        for (const status of message.status) {
            let media = this.media.find(
                media => media.mediaSessionId === status.mediaSessionId
            );

            if (!media) {
                media = createMedia(
                    [this.sessionId, status.mediaSessionId],
                    this.#sendMediaMessage
                );
                this.media.push(media);
                updateMedia(media, status);
            } else {
                updateMedia(media, status);
            }
        }

        // Handle media request responses
        const mediaRequest = this.#mediaRequests.get(message.requestId);
        if (mediaRequest) {
            mediaRequest.successCallback();
        }

        for (const status of message.status) {
            const media = this.media.find(
                media => media.mediaSessionId === status.mediaSessionId
            );
            if (!media) continue;

            const updateListeners = mediaUpdateListeners.get(media);
            if (updateListeners) {
                for (const listener of updateListeners) {
                    listener(true);
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
        this.#sendMediaMessage(loadRequest)
            .then(() => {
                successCallback?.(this.media[this.media.length - 1]);
            })
            .catch(errorCallback);
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
