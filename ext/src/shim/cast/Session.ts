"use strict";

import { v4 as uuid } from "uuid";

import logger from "../../lib/logger";

import { onMessage
       , sendMessageResponse } from "../eventMessageChannel";

import { ErrorCallback
       , LoadSuccessCallback
       , MediaListener
       , MessageListener
       , SuccessCallback
       , UpdateListener } from "../types";

import { SenderMediaMessage, SenderMessage } from "./types";

import { Error as _Error
       , Image, Receiver
       , SenderApplication, Volume } from "./dataClasses";
import { ErrorCode, SessionStatus } from "./enums";

import { Media
       , LoadRequest
       , QueueLoadRequest } from "./media";


type SenderMessageData<T = SenderMessage> =
        T extends any
            ? Omit<T, "requestId">
            : never;

type SessionSuccessCallback = (session: Session) => void;

export default class Session {
    #id = uuid();

    #isConnected = false;
    #successCallback?: SessionSuccessCallback;

    #messageListeners = new Map<string, Set<MessageListener>>();
    #updateListeners = new Set<UpdateListener>();

    #sendMessageCallbacks =
            new Map<string, [ SuccessCallback?, ErrorCallback? ]>();
    #sendReceiverMessageCallbacks =
            new Map<string, (wasError: boolean) => void>();

    #listener = onMessage(message => {
        // Filter other session messages
        if ((message as any).data._id !== this.#id) {
            return;
        }

        switch (message.subject) {
            case "shim:session/stopped": {
                // Disconnect from extension messages
                this.#listener.disconnect();

                this.status = SessionStatus.STOPPED;

                for (const listener of this.#updateListeners) {
                    listener(false);
                }

                break;
            }

            case "shim:session/updateStatus": {
                const { status } = message.data;

                // First status message indicates session creation
                if (!this.#isConnected && status.applications) {
                    this.#isConnected = true;

                    this.status = SessionStatus.CONNECTED;

                    // Update app props
                    const app = status.applications[0];
                    this.sessionId = app.sessionId;
                    this.namespaces = app.namespaces;
                    this.displayName = app.displayName;
                    this.statusText = app.statusText;

                    if (this.#successCallback) {
                        this.#successCallback(this);
                    }

                    return;
                }

                this.receiver.volume = status.volume;

                for (const listener of this.#updateListeners) {
                    listener(true);
                }

                break;
            }


            case "shim:session/impl_addMessageListener": {
                const { namespace, message: newMessage } = message.data;
                const messageListeners = this.#messageListeners.get(namespace);

                if (messageListeners) {
                    for (const listener of messageListeners) {
                        listener(namespace, newMessage);
                    }
                }

                break;
            }

            case "shim:session/impl_sendMessage": {
                const { messageId, wasError } = message.data;
                const [ successCallback, errorCallback ] =
                        this.#sendMessageCallbacks.get(messageId) ?? [];

                if (wasError && errorCallback) {
                    errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                } else if (successCallback) {
                    successCallback();
                }

                this.#sendMessageCallbacks.delete(messageId);

                break;
            }

            case "shim:session/impl_sendReceiverMessage": {
                const { messageId, wasError } = message.data;
                const callback =
                        this.#sendReceiverMessageCallbacks.get(messageId);
                if (callback) {
                    callback(wasError);
                }

                break;
            }
        }
    });

    /**
     * Sends a message to the bridge that is forwarded to the
     * receiver device. Promise resolves once the message is sent
     * or an error occurs.
     */
     #sendReceiverMessage = (message: SenderMessageData) => {
        const messageId = uuid();
        sendMessageResponse({
            subject: "bridge:session/impl_sendReceiverMessage"
          , data: {
                message: { requestId: 0, ...message }
              , messageId
              , _id: this.#id
            }
        });

        return new Promise<void>((resolve, reject) => {   
            this.#sendReceiverMessageCallbacks.set(messageId
                  , (wasError: boolean) => {

                if (wasError) {
                    reject(new _Error(ErrorCode.SESSION_ERROR));
                    return;
                }

                resolve();
            });
        });
    }

    private _sendMediaMessage(message: SenderMediaMessage) {
        this.sendMessage("urn:x-cast:com.google.cast.media", message);
    }

    media: Media[] = [];
    namespaces: Array<{ name: string }> = [];
    senderApps: SenderApplication[] = [];
    status = SessionStatus.CONNECTED;
    statusText: Nullable<string> = null;
    transportId: string;

    constructor(public sessionId: string
              , public appId: string
              , public displayName: string
              , public appImages: Image[]
              , public receiver: Receiver
              , _successCallback: SessionSuccessCallback) {

        this.#successCallback = _successCallback;
        this.transportId = sessionId || "";

        if (receiver) {
            sendMessageResponse({
                subject: "bridge:session/initialize"
              , data: {
                    address: (receiver as any)._address
                  , port: (receiver as any)._port
                  , appId
                  , sessionId
                  , _id: this.#id
                }
            });
        }
    }


    addMediaListener(_mediaListener: MediaListener) {
        logger.info("STUB :: Session#addMediaListener");
    }

    addMessageListener(namespace: string
                     , listener: MessageListener) {

        if (!this.#messageListeners.has(namespace)) {
            this.#messageListeners.set(namespace, new Set());
        }

        this.#messageListeners.get(namespace)?.add(listener);

        sendMessageResponse({
            subject: "bridge:session/impl_addMessageListener"
          , data: {
                namespace
              , _id: this.#id
            }
        });
    }

    addUpdateListener(listener: UpdateListener) {
        this.#updateListeners.add(listener);
    }

    leave(_successCallback?: SuccessCallback
        , _errorCallback?: ErrorCallback): void {

        logger.info("STUB :: Session#leave");
    }

    loadMedia(loadRequest: LoadRequest
            , successCallback?: LoadSuccessCallback
            , errorCallback?: ErrorCallback): void {

        this._sendMediaMessage(loadRequest);


        let hasResponded = false;

        this.addMessageListener(
                "urn:x-cast:com.google.cast.media"
              , (_namespace, data) => {

            if (hasResponded) {
                return;
            }

            const message = JSON.parse(data);

            if (message.status && message.status.length > 0) {
                const sessionId = this.#id;
                if (!sessionId) {
                    return;
                }

                hasResponded = true;

                const media = new Media(
                        this.sessionId
                      , message.status[0].mediaSessionId
                      , sessionId);

                media.media = loadRequest.media;
                this.media = [ media ];

                media.play();

                if (successCallback) {
                    successCallback(media);
                }
            } else {
                if (errorCallback) {
                    errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                }
            }
        });
    }

    queueLoad(_queueLoadRequest: QueueLoadRequest
            , _successCallback?: LoadSuccessCallback
            , _errorCallback?: ErrorCallback): void {

        logger.info("STUB :: Session#queueLoad");
    }

    removeMediaListener(_mediaListener: MediaListener): void {
        logger.info("STUB :: Session#removeMediaListener");
    }
    removeMessageListener(namespace: string, listener: MessageListener): void {
        this.#messageListeners.get(namespace)?.delete(listener);
    }
    removeUpdateListener(_namespace: string, listener: UpdateListener): void {
        this.#updateListeners.delete(listener);
    }

    sendMessage(namespace: string
              , message: {} | string
              , successCallback?: SuccessCallback
              , errorCallback?: ErrorCallback): void {

        const messageId = uuid();

        sendMessageResponse({
            subject: "bridge:session/impl_sendMessage"
          , data: {
                namespace
              , message
              , messageId
              , _id: this.#id
            }
        });

        this.#sendMessageCallbacks.set(messageId, [
            successCallback
          , errorCallback
        ]);
    }

    setReceiverMuted(muted: boolean
                   , successCallback?: SuccessCallback
                   , errorCallback?: ErrorCallback) {

        this.#sendReceiverMessage(
                { type: "SET_VOLUME"
                , volume: { muted }})
            .then(successCallback)
            .catch(errorCallback);
    }

    setReceiverVolumeLevel(newLevel: number
                         , successCallback?: SuccessCallback
                         , errorCallback?: ErrorCallback): void {

        this.#sendReceiverMessage(
                { type: "SET_VOLUME"
                , volume: { level: newLevel }})
            .then(successCallback)
            .catch(errorCallback);
    }

    stop(successCallback?: SuccessCallback
       , errorCallback?: ErrorCallback): void {

        this.#sendReceiverMessage(
                { type: "STOP"
                , sessionId: this.sessionId })
            .then(successCallback)
            .catch(errorCallback);
    }
}
