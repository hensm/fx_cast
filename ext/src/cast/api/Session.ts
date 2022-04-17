"use strict";

import { v4 as uuid } from "uuid";

import logger from "../../lib/logger";

import { sendMessageResponse } from "../eventMessageChannel";

import {
    ErrorCallback,
    LoadSuccessCallback,
    MediaListener,
    MessageListener,
    SuccessCallback,
    UpdateListener
} from "../types";

import {
    MediaStatus,
    ReceiverMediaMessage,
    SenderMediaMessage,
    SenderMessage
} from "./types";

import { Image, Receiver, SenderApplication } from "./dataClasses";
import { SessionStatus } from "./enums";
import {
    Media,
    LoadRequest,
    QueueLoadRequest,
    QueueItem,
    MediaCommand
} from "./media";

const NS_MEDIA = "urn:x-cast:com.google.cast.media";

/** supportedMediaCommands bitflag returned in MEDIA_STATUS messages */
enum _MediaCommand {
    PAUSE = 1,
    SEEK = 2,
    STREAM_VOLUME = 4,
    STREAM_MUTE = 8,
    QUEUE_NEXT = 64,
    QUEUE_PREV = 128
}

/**
 * Takes a media object and a media status object and merges
 * the status with the existing media object, updating it with
 * new properties.
 */
function updateMedia(media: Media, status: MediaStatus) {
    if (status.currentTime) {
        media._lastUpdateTime = Date.now();
    }

    // Copy props
    for (const prop in status) {
        switch (prop) {
            case "items":
            case "supportedMediaCommands":
                continue;
        }

        if (status.hasOwnProperty(prop)) {
            (media as any)[prop] = (status as any)[prop];
        }
    }

    // Convert supportedMediaCommands bitflag to string array
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

export default class Session {
    #id = uuid();

    #isConnected = false;

    #loadMediaSuccessCallback?: (media: Media) => void;
    #loadMediaErrorCallback?: ErrorCallback;
    #loadMediaRequest?: LoadRequest;

    _messageListeners = new Map<string, Set<MessageListener>>();
    _updateListeners = new Set<UpdateListener>();

    _sendMessageCallbacks = new Map<
        string,
        [SuccessCallback?, ErrorCallback?]
    >();

    /**
     *
     */
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

                    console.info(media);

                    // Handle Media creation
                    if (!media) {
                        media = new Media(
                            this.sessionId,
                            mediaStatus.mediaSessionId,
                            this.#sendMediaMessage
                        );

                        this.media.push(media);
                        this.#loadMediaSuccessCallback?.(media);
                    }

                    updateMedia(media, mediaStatus);

                    for (const listener of media._updateListeners) {
                        listener(true);
                    }

                    break;
                }
            }
        }
    };

    /**
     * Sends a media message to the app receiver.
     * urn:x-cast:com.google.cast.media
     */
    #sendMediaMessage = (
        message: DistributiveOmit<SenderMediaMessage, "requestId">
    ) => {
        return new Promise<void>((resolve, reject) => {
            this.sendMessage(
                "urn:x-cast:com.google.cast.media",
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

            sendMessageResponse({
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

    addMediaListener(_mediaListener: MediaListener) {
        logger.info("STUB :: Session#addMediaListener");
    }
    removeMediaListener(_mediaListener: MediaListener) {
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

    leave(_successCallback?: SuccessCallback, _errorCallback?: ErrorCallback) {
        logger.info("STUB :: Session#leave");
    }

    loadMedia(
        loadRequest: LoadRequest,
        successCallback?: LoadSuccessCallback,
        errorCallback?: ErrorCallback
    ) {
        this.#loadMediaSuccessCallback = successCallback;
        this.#loadMediaErrorCallback = errorCallback;
        this.#loadMediaRequest = loadRequest;

        loadRequest.sessionId = this.sessionId;
        this.#sendMediaMessage(loadRequest).catch(errorCallback);
    }

    queueLoad(
        _queueLoadRequest: QueueLoadRequest,
        _successCallback?: LoadSuccessCallback,
        _errorCallback?: ErrorCallback
    ) {
        logger.info("STUB :: Session#queueLoad");
    }

    sendMessage(
        namespace: string,
        message: object | string,
        successCallback?: SuccessCallback,
        errorCallback?: ErrorCallback
    ) {
        const messageId = uuid();

        sendMessageResponse({
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
        successCallback?: SuccessCallback,
        errorCallback?: ErrorCallback
    ) {
        this.#sendReceiverMessage({ type: "SET_VOLUME", volume: { muted } })
            .then(successCallback)
            .catch(errorCallback);
    }

    setReceiverVolumeLevel(
        newLevel: number,
        successCallback?: SuccessCallback,
        errorCallback?: ErrorCallback
    ) {
        this.#sendReceiverMessage({
            type: "SET_VOLUME",
            volume: { level: newLevel }
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    stop(successCallback?: SuccessCallback, errorCallback?: ErrorCallback) {
        this.#sendReceiverMessage({ type: "STOP", sessionId: this.sessionId })
            .then(successCallback)
            .catch(errorCallback);
    }
}
