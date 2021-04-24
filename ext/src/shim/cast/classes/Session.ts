"use strict";

import { v4 as uuid } from "uuid";

import logger from "../../../lib/logger";

import _Error from "./Error";
import Image from "./Image";
import Receiver from "./Receiver";
import SenderApplication from "./SenderApplication";
import Volume from "./Volume";

import LoadRequest from "../media/classes/LoadRequest";
import Media from "../media/classes/Media";
import QueueLoadRequest from "../media/classes/QueueLoadRequest";

import { ErrorCode
       , SessionStatus } from "../enums";

import { RepeatMode } from "../media/enums";

import { ListenerObject
       , onMessage
       , sendMessageResponse } from "../../eventMessageChannel";

import { Callbacks
       , ErrorCallback
       , LoadSuccessCallback
       , MediaListener
       , MessageListener
       , SuccessCallback
       , UpdateListener } from "../../types";


type SessionSuccessCallback = (session: Session) => void;

export default class Session {
    #id = uuid();

    #successCallback?: SessionSuccessCallback;

    #messageListeners = new Map<string, Set<MessageListener>>();
    #updateListeners = new Set<UpdateListener>();

    #leaveCallbacks = new Map<string, Callbacks>();
    #sendMessageCallbacks = new Map<string, Callbacks>();
    #setReceiverMutedCallbacks = new Map<string, Callbacks>();
    #setReceiverVolumeLevelCallbacks = new Map<string, Callbacks>();
    #stopCallbacks = new Map<string, Callbacks>();

    #listener = onMessage(message => {
        // Filter other session messages
        if ((message as any).data._id !== this.#id) {
            return;
        }

        switch (message.subject) {
            case "shim:/session/stopped": {
                // Disconnect from extension messages
                this.#listener.disconnect();

                this.status = SessionStatus.STOPPED;

                for (const listener of this.#updateListeners) {
                    listener(false);
                }

                break;
            }

            case "shim:/session/connected": {
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

            case "shim:/session/updateStatus": {
                const volume: Volume = message.data.volume;

                if (volume) {
                    if (!this.receiver.volume) {
                        const receiverVolume = new Volume(
                                volume.level
                              , volume.muted);

                        receiverVolume.controlType = volume.controlType;
                        receiverVolume.stepInterval = volume.stepInterval;

                        this.receiver.volume = receiverVolume;
                    } else {
                        this.receiver.volume.level = volume.level;
                        this.receiver.volume.muted = volume.muted;
                    }
                }

                for (const listener of this.#updateListeners) {
                    listener(true);
                }

                break;
            }


            case "shim:/session/impl_addMessageListener": {
                const { namespace, data } = message.data;
                const messageListeners = this.#messageListeners.get(namespace);

                if (messageListeners) {
                    for (const listener of messageListeners) {
                        listener(namespace, data);
                    }
                }

                break;
            }

            case "shim:/session/impl_sendMessage": {
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

            case "shim:/session/impl_setReceiverMuted": {
                const { volumeId, error } = message.data;
                const [ successCallback, errorCallback ] =
                        this.#setReceiverMutedCallbacks.get(volumeId) ?? [];

                if (error && errorCallback) {
                    errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                } else if (successCallback) {
                    successCallback();
                }

                this.#setReceiverMutedCallbacks.delete(volumeId);

                break;
            }

            case "shim:/session/impl_setReceiverVolumeLevel": {
                const { volumeId, error } = message.data;
                const [ successCallback, errorCallback ] =
                        this.#setReceiverVolumeLevelCallbacks
                            .get(volumeId) ?? [];

                if (error && errorCallback) {
                    errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                } else if (successCallback) {
                    successCallback();
                }

                this.#setReceiverVolumeLevelCallbacks.delete(volumeId);

                break;
            }

            case "shim:/session/impl_stop": {
                const { stopId, error } = message.data;
                const [ successCallback, errorCallback ]
                        = this.#stopCallbacks.get(stopId) ?? [];

                // Disconnect from extension messages
                this.#listener.disconnect();

                if (error && errorCallback) {
                    errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                } else {
                    this.status = SessionStatus.STOPPED;

                    for (const listener of this.#updateListeners) {
                        listener(false);
                    }

                    if (successCallback) {
                        successCallback();
                    }
                }

                this.#stopCallbacks.delete(stopId);

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

    constructor (
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
                subject: "bridge:/session/initialize"
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


    public addMediaListener (_mediaListener: MediaListener) {
        logger.info("STUB :: Session#addMediaListener");
    }

    public addMessageListener (
            namespace: string
          , listener: MessageListener) {

        if (!this.#messageListeners.has(namespace)) {
            this.#messageListeners.set(namespace, new Set());
        }

        this.#messageListeners.get(namespace)?.add(listener);

        sendMessageResponse({
            subject: "bridge:/session/impl_addMessageListener"
          , data: {
                namespace
              , _id: this.#id
            }
        });
    }

    public addUpdateListener (listener: UpdateListener) {
        this.#updateListeners.add(listener);
    }

    public leave (
            successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        const id = uuid();

        sendMessageResponse({
            subject: "bridge:/session/impl_leave"
          , data: {
                id
              , _id: this.#id
            }
        });

        this.#leaveCallbacks.set(id, [
            successCallback
          , errorCallback
        ]);
    }

    public loadMedia (
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

    public queueLoad (
            _queueLoadRequest: QueueLoadRequest
          , _successCallback?: LoadSuccessCallback
          , _errorCallback?: ErrorCallback): void {

        logger.info("STUB :: Session#queueLoad");
    }

    public removeMediaListener (_mediaListener: MediaListener): void {
        logger.info("STUB :: Session#removeMediaListener");
    }

    public removeMessageListener (
            namespace: string
          , listener: MessageListener): void {

        this.#messageListeners.get(namespace)?.delete(listener);
    }

    public removeUpdateListener (
            _namespace: string
          , listener: UpdateListener): void {

        this.#updateListeners.delete(listener);
    }

    public sendMessage (
            namespace: string
          , message: {} | string
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        const messageId = uuid();

        sendMessageResponse({
            subject: "bridge:/session/impl_sendMessage"
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

    public setReceiverMuted (
            muted: boolean
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback) {

        const volumeId = uuid();

        sendMessageResponse({
            subject: "bridge:/session/impl_setReceiverMuted"
          , data: {
                muted
              , volumeId
              , _id: this.#id
            }
        });

        this.#setReceiverMutedCallbacks.set(volumeId, [
            successCallback
          , errorCallback
        ]);
    }

    public setReceiverVolumeLevel (
            newLevel: number
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        const volumeId = uuid();

        sendMessageResponse({
            subject: "bridge:/session/impl_setReceiverVolumeLevel"
          , data: {
                newLevel
              , volumeId
              , _id: this.#id
            }
        });

        this.#setReceiverVolumeLevelCallbacks.set(volumeId, [
            successCallback
          , errorCallback
        ]);
    }

    public stop (
            successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        const stopId = uuid();

        sendMessageResponse({
            subject: "bridge:/session/impl_stop"
          , data: {
                stopId
              , _id: this.#id
            }
        });

        this.#stopCallbacks.set(stopId, [
            successCallback
          , errorCallback
        ]);
    }


    private _sendMediaMessage (message: string | {}) {
        this.sendMessage("urn:x-cast:com.google.cast.media", message);
    }
}
