"use strict";

import { v4 as uuid } from "uuid";

import logger from "../../lib/logger";

import eventMessaging from "../pageMessenging";

import {
    MediaStatus,
    ReceiverMediaMessage,
    SenderMediaMessage,
    SenderMessage,
    _MediaCommand
} from "./types";

import { SessionStatus } from "./enums";
import type {
    Error as CastError,
    Image,
    Receiver,
    SenderApplication
} from "./classes";

import { MediaCommand } from "./media/enums";
import type { LoadRequest, QueueLoadRequest, QueueItem } from "./media/classes";
import Media, { NS_MEDIA } from "./media/Media";

/**
 * Takes a media object and a media status object and merges the status
 * with the existing media object, updating it with new properties.
 */
function updateMedia(media: Media, status: MediaStatus) {
    if (status.currentTime) {
        media._lastUpdateTime = Date.now();
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

    // Convert supportedMediaCommands bitflags to string array
    const supportedMediaCommands: string[] = [];
    if (status.supportedMediaCommands & _MediaCommand.PAUSE) {
        supportedMediaCommands.push(MediaCommand.PAUSE);
    } else if (status.supportedMediaCommands & _MediaCommand.SEEK) {
        supportedMediaCommands.push(MediaCommand.SEEK);
    } else if (status.supportedMediaCommands & _MediaCommand.STREAM_VOLUME) {
        supportedMediaCommands.push(MediaCommand.STREAM_VOLUME);
    } else if (status.supportedMediaCommands & _MediaCommand.STREAM_MUTE) {
        supportedMediaCommands.push(MediaCommand.STREAM_MUTE);
    } else if (status.supportedMediaCommands & _MediaCommand.QUEUE_NEXT) {
        supportedMediaCommands.push("queue_next");
    } else if (status.supportedMediaCommands & _MediaCommand.QUEUE_PREV) {
        supportedMediaCommands.push("queue_prev");
    }

    media.supportedMediaCommands = supportedMediaCommands;

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

type MessageListener = (namespace: string, message: string) => void;
type UpdateListener = (isAlive: boolean) => void;

export default class Session {
    #loadMediaRequest?: LoadRequest;
    #loadMediaSuccessCallback?: (media: Media) => void;
    #loadMediaErrorCallback?: (err: CastError) => void;

    _messageListeners = new Map<string, Set<MessageListener>>();
    _updateListeners = new Set<UpdateListener>();

    _sendMessageCallbacks = new Map<
        string,
        [(() => void)?, ((err: CastError) => void)?]
    >();

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
                        media = new Media(
                            this.sessionId,
                            mediaStatus.mediaSessionId,
                            this.#sendMediaMessage
                        );

                        this.media.push(media);
                        updateMedia(media, mediaStatus);
                        this.#loadMediaSuccessCallback?.(media);
                    } else {
                        updateMedia(media, mediaStatus);
                        for (const listener of media._updateListeners) {
                            listener(true);
                        }
                    }
                }
            }
        }
    };

    /**
     * Sends a media message to the app receiver.
     */
    #sendMediaMessage = (
        message: DistributiveOmit<SenderMediaMessage, "requestId">
    ) => {
        return new Promise<void>((resolve, reject) => {
            this.sendMessage(
                NS_MEDIA,
                { ...message, requestId: 0 },
                resolve,
                reject
            );
        });
    };

    #sendReceiverMessage = (
        message: DistributiveOmit<SenderMessage, "requestId">
    ) => {
        return new Promise<void>((resolve, reject) => {
            const messageId = uuid();

            eventMessaging.page.sendMessage({
                subject: "bridge:sendCastReceiverMessage",
                data: {
                    sessionId: this.sessionId,
                    messageData: message as SenderMessage,
                    messageId
                }
            });

            this._sendMessageCallbacks.set(messageId, [resolve, reject]);
        });
    };

    addMediaListener(_mediaListener: (media: Media) => void) {
        logger.info("STUB :: Session#addMediaListener");
    }
    removeMediaListener(_mediaListener: (media: Media) => void) {
        logger.info("STUB :: Session#removeMediaListener");
    }

    addMessageListener(namespace: string, listener: MessageListener) {
        if (!this._messageListeners.has(namespace)) {
            this._messageListeners.set(namespace, new Set());
        }

        this._messageListeners.get(namespace)?.add(listener);
    }
    removeMessageListener(namespace: string, listener: MessageListener) {
        this._messageListeners.get(namespace)?.delete(listener);
    }

    addUpdateListener(listener: UpdateListener) {
        this._updateListeners.add(listener);
    }
    removeUpdateListener(listener: UpdateListener) {
        this._updateListeners.delete(listener);
    }

    leave(
        _successCallback?: () => void,
        _errorCallback?: (err: CastError) => void
    ) {
        logger.info("STUB :: Session#leave");
    }

    loadMedia(
        loadRequest: LoadRequest,
        successCallback?: (media: Media) => void,
        errorCallback?: (err: CastError) => void
    ) {
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

        eventMessaging.page.sendMessage({
            subject: "bridge:sendCastSessionMessage",
            data: {
                sessionId: this.sessionId,
                namespace,
                messageData: message,
                messageId
            }
        });

        this._sendMessageCallbacks.set(messageId, [
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
