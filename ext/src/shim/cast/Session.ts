"use strict";

import { v4 as uuid } from "uuid";

import logger from "../../lib/logger";
import { SessionReceiverMessage } from "../../types";

import { onMessage
       , sendMessageResponse } from "../eventMessageChannel";

import { Callbacks
       , ErrorCallback
       , LoadSuccessCallback
       , MediaListener
       , MessageListener
       , SuccessCallback
       , UpdateListener } from "../types";

import { Error as _Error
       , Image, Receiver
       , SenderApplication, Volume } from "./dataClasses";
import { ErrorCode, SessionStatus } from "./enums";

import { Media
       , LoadRequest
       , QueueLoadRequest
         // Enums
       , RepeatMode } from "./media";


type SessionSuccessCallback = (session: Session) => void;

export default class Session {
    #id = uuid();

    #successCallback?: SessionSuccessCallback;

    #messageListeners = new Map<string, Set<MessageListener>>();
    #updateListeners = new Set<UpdateListener>();

    #sendMessageCallbacks = new Map<string, Callbacks>();
    #sendReceiverMessageCallbacks = new Map<string, Function>();

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

            case "shim:session/connected": {
                this.status = SessionStatus.CONNECTED;
                this.sessionId = message.data.sessionId;
                this.transportId = message.data.sessionId;
                this.namespaces = message.data.namespaces;
                this.displayName = message.data.displayName;
                this.statusText = message.data.statusText;

                if (this.#successCallback) {
                    this.#successCallback(this);
                }

                break;
            }

            case "shim:session/updateStatus": {
                const status = message.data;

                if (status.volume) {
                    if (!this.receiver.volume) {
                        const receiverVolume = new Volume(
                                status.volume.level, status.volume.muted);

                        receiverVolume.controlType = status.volume.controlType;
                        receiverVolume.stepInterval =
                                status.volume.stepInterval;
                    } else {
                        this.receiver.volume.level = status.volume.level;
                        this.receiver.volume.muted = status.volume.muted;
                    }
                }

                for (const listener of this.#updateListeners) {
                    listener(true);
                }

                break;
            }

            case "shim:session/sendReceiverMessageResponse": {
                const { messageId, wasError } = message.data;
                const callback =
                        this.#sendReceiverMessageCallbacks.get(messageId);
                if (callback) {
                    callback(wasError);
                }

                break;
            }


            case "shim:session/impl_addMessageListener": {
                const { namespace, data } = message.data;
                const messageListeners = this.#messageListeners.get(namespace);

                if (messageListeners) {
                    for (const listener of messageListeners) {
                        listener(namespace, data);
                    }
                }

                break;
            }

            case "shim:session/impl_sendMessage": {
                const { messageId, error } = message.data;
                const [ successCallback, errorCallback ] =
                        this.#sendMessageCallbacks.get(messageId) ?? [];

                if (error && errorCallback) {
                    errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                } else if (successCallback) {
                    successCallback();
                }

                this.#sendMessageCallbacks.delete(messageId);

                break;
            }
        }
    })

    public media: Media[];
    public namespaces: Array<{ name: string }>;
    public senderApps: SenderApplication[];
    public status: SessionStatus;
    public statusText: string | null;
    public transportId: string;

    constructor(
            public sessionId: string
          , public appId: string
          , public displayName: string
          , public appImages: Image[]
          , public receiver: Receiver
          , _successCallback: SessionSuccessCallback) {

        this.#successCallback = _successCallback;

        this.media = [];
        this.namespaces = [];
        this.senderApps = [];
        this.status = SessionStatus.CONNECTED;
        this.statusText = null;
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


    public addMediaListener(_mediaListener: MediaListener) {
        logger.info("STUB :: Session#addMediaListener");
    }

    public addMessageListener(
            namespace: string
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

    public addUpdateListener(listener: UpdateListener) {
        this.#updateListeners.add(listener);
    }

    public leave(
            _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {

        logger.info("STUB :: Session#leave");
    }

    public loadMedia(
            loadRequest: LoadRequest
          , successCallback?: LoadSuccessCallback
          , errorCallback?: ErrorCallback): void {

        this._sendMediaMessage({
            type: "LOAD"
          , requestId: 0
          , media: loadRequest.media
          , activeTrackIds: loadRequest.activeTrackIds || []
          , autoplay: loadRequest.autoplay || false
          , currentTime: loadRequest.currentTime || 0
          , customData: loadRequest.customData || {}
          , repeatMode: RepeatMode.OFF
        });


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

    public queueLoad(
            _queueLoadRequest: QueueLoadRequest
          , _successCallback?: LoadSuccessCallback
          , _errorCallback?: ErrorCallback): void {

        logger.info("STUB :: Session#queueLoad");
    }

    public removeMediaListener(_mediaListener: MediaListener): void {
        logger.info("STUB :: Session#removeMediaListener");
    }

    public removeMessageListener(
            namespace: string
          , listener: MessageListener): void {

        this.#messageListeners.get(namespace)?.delete(listener);
    }

    public removeUpdateListener(
            _namespace: string
          , listener: UpdateListener): void {

        this.#updateListeners.delete(listener);
    }

    public sendMessage(
            namespace: string
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

    public setReceiverMuted(
            muted: boolean
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback) {

        this.#sendReceiverMessage(
                { type: "SET_VOLUME"
                , volume: { muted }})
            .then(successCallback)
            .catch(errorCallback);
    }

    public setReceiverVolumeLevel(
            newLevel: number
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this.#sendReceiverMessage(
                { type: "SET_VOLUME"
                , volume: { level: newLevel }})
            .then(successCallback)
            .catch(errorCallback);
    }

    public stop(
            successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this.#sendReceiverMessage(
                { type: "STOP"
                , sessionId: this.sessionId })
            .then(successCallback)
            .catch(errorCallback);
    }


    /**
     * Sends a message to the bridge that is forwarded to the
     * receiver device. Promise resolves once the message is sent
     * or an error occurs.
     */
    #sendReceiverMessage = (message: SessionReceiverMessage) => {
        return new Promise<void>((resolve, reject) => {
            if (!(message as any).requestId) {
                (message as any).requestId = 0;
            }
            
            const messageId = uuid();
            sendMessageResponse({
                subject: "bridge:session/sendReceiverMessage"
              , data: { message, messageId, _id: this.#id }
            });
    
            this.#sendReceiverMessageCallbacks.set(
                    messageId, (wasError: boolean) => {
                if (wasError) {
                    reject(new _Error(ErrorCode.SESSION_ERROR));
                    return;
                }

                resolve();
            });
        });
    }

    private _sendMediaMessage(message: string | {}) {
        this.sendMessage("urn:x-cast:com.google.cast.media", message);
    }
}
