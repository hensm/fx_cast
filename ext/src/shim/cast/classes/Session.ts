"use strict";

import _Error from "./Error";
import Image from "./Image";
import Receiver from "./Receiver";
import SenderApplication from "./SenderApplication";
import Volume from "./Volume";

import LoadRequest from "../../media/classes/LoadRequest";
import Media from "../../media/classes/Media";
import QueueLoadRequest from "../../media/classes/QueueLoadRequest";

import { SessionStatus
       , ErrorCode
       , VolumeControlType } from "../enums";

import { onMessage, sendMessageResponse } from "../../messageBridge";

import uuid from "uuid/v1";


type SuccessCallback = () => void;
type ErrorCallback = (err: Error_) => void;

type MediaListener = (media: Media) => void;
type MessageListener = (namespace: string, message: string) => void;
type UpdateListener = (isAlive: boolean) => void;
type LoadSuccessCallback = (media: Media) => void;

export default interface Session {
    appId: string;
    appImages: Image[];
    displayName: string;
    media: Media[];
    namespaces: { name: string }[];
    receiver: Receiver;
    senderApps: SenderApplication[];
    sessionId: string;
    status: string;
    statusText: string;
    transportId: string;

    addMediaListener (listener: MediaListener): void;

    addMessageListener (
            namespace: string
          , listener: MessageListener): void;

    addUpdateListener (listener: UpdateListener): void;

    leave ( successCallback: SuccessCallback
          , errorCallback: ErrorCallback): void;

    loadMedia (
            loadRequest: LoadRequest
          , successCallback: LoadSuccessCallback
          , errorCallback: ErrorCallback): void;

    queueLoad (
            queueLoadRequest: QueueLoadRequest
          , successCallback: LoadSuccessCallback;
          , errorCallback: ErrorCallback): void;

    removeMediaListener (listener: MediaListener): void;

    removeMessageListener(
            namespace: string
          , listener: MessageListener): void;

    removeUpdateListener (listener: UpdateListener): void;

    sendMessage (
            namespace: string
          , message: {} | string
          , successCallback: SuccessCallback
          , errorCallback: ErrorCallback): void;

    setReceiverMuted (
            muted: boolean
          , successCallback: SuccessCallback
          , errorCallback: ErrorCallback): void;

    setReceiverVolumeLevel (
            newLevel: number
          , successCallback: SuccessCallback
          , errorCallback: ErrorCallback): void;

    stop (  successCallback: SuccessCallback
          , errorCallback: ErrorCallback): void;
}


type Callbacks = [ SuccessCallback, ErrorCallback ];
type CallbacksMap = Map<string, Callbacks>;

export class SessionWrapper extends EventTarget {
    private id = uuid();
    private messageListeners = new Map<string, Set<MessageListener>>();
    private updateListeners = new Set<UpdateListener>();

    private leaveCallbacks: CallbacksMap = new Map();
    private sendMessageCallbacks: CallbacksMap = new Map();
    private setReceiverMutedCallbacks: CallbacksMap = new Map();
    private setReceiverVolumeLevelCallbacks: CallbacksMap = new Map();
    private stopCallbacks: CallbacksMap = new Map();

    constructor (
            private sessionId: string
          , private appId: string
          , private displayName: string
          , private appImages: Image[]
          , private receiver: Receiver) {

        super();

        this.sendMessageEvent("initialized", {
            address: (receiver as any)._address
          , port: (receiver as any)._port
          , appId
          , sessionId
        });
    }

    private interface: Session = {
        sessionId: this.sessionId
      , transportId: this.sessionId
      , appId: this.appId
      , appImages: this.appImages
      , displayName: this.displayName
      , receiver: this.receiver
      , media: []
      , namespaces: []
      , senderApps: []
      , status: SessionStatus.CONNECTED
      , statusText: null

      , addMediaListener (listener) {
            console.info("STUB :: Session#addMediaListener")
        }

      , addMessageListener: (namespace, listener) => {
            if (!this.messageListeners.has(namespace)) {
                this.messageListeners.set(namespace, new Set());
            }

            this.messageListeners.get(namespace).add(listener);
            this.sendMessageEvent("impl_addMessageListener", { namespace });
        }

      , addUpdateListener: (listener) => {
            this.updateListeners.add(listener);
        }

      , leave: (successCallback, errorCallback) => {
            const id = uuid();
            this.leaveCallbacks.set(id, [
                successCallback
              , errorCallback
            ]);

            this.sendMessageEvent("impl_leave", { id });
        }

      , loadMedia: (loadRequest, successCallback, errorCallback) {
            this.sendMediaMessage({
                type: "LOAD"
              , requestId: 0
              , media: loadRequest.media
              , activeTrackIds: loadRequest.activeTrackIds || []
              , autoplay: loadRequest.autoplay || false
              , currentTime: loadRequest.currentTime || 0
              , customData: loadRequest.customData || {}
              , repeatMode: "REPEAT_OFF"
            });

            let hasResponded = false;

            this.interface.addMessageListener(
                    "urn:x-cast:com.google.cast.media"
                  , (namespace, data) => {

                if (hasResponded) {
                    return;
                }

                const mediaObject = JSON.parse(data);

                if (mediaObject.status && mediaObject.status.length > 0) {
                    hasResponded = true;

                    const media = new Media(
                            this.sessionId
                          , mediaObject.status[0].mediaSessionId
                          , this._id);

                    media.media = loadRequest.media;
                    this.media = [ media ];

                    media.play();
                    successCallback(media);
                } else {
                    errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                }
            })
        }

      , queueLoad: () => {
            console.info("STUB :: Session#queueLoad");
        }

      , removeMediaListener: (listener) => {
            console.info("STUB :: Session#removeMediaListener");
        }

       , removeMessageListener: (namespace, listener) => {
            this.messageListeners.get(namespace).delete(listener);
        }

       , removeUpdateListener: (listener) => {
            this.updateListeners.delete(listener);
        }

      , sendMessage: (namespace, message, successCallback, errorCallback) => {
            const messageId = uuid();
            this.sendMessageCallbacks.set(messageId, [
                successCallback
              , errorCallback
            ]);

            this.sendMessageEvent("impl_sendMessage", {
                namespace
              , message
              , messageId
            });
        }


      , setReceiverMuted: (muted, successCallback, errorCallback) => {
            const volumeId = uuid();
            this.setReceiverMutedCallbacks.set(volumeId, [
                successCallback
              , errorCallback
            ]);

            this.sendMessageEvent("impl_setReceiverMuted", {
                muted
              , volumeId
            });
        }

      , setReceiverVolumeLevel: (newLevel, successCallback, errorCallback) => {
            const volumeId = uuid();
            this.setReceiverVolumeLevelCallbacks.set(volumeId, [
                successCallback
              , errorCallback
            ]);

            this.sendMessageEvent("impl_setReceiverVolumeLevel", {
                newLevel
              , volumeId
            });
        }

      , stop: (successCallback, errorCallback) => {
            const stopId = uuid();
            this.stopCallbacks.set(stopId, [
                successCallback
              , errorCallback
            ]);

            this.sendMessageEvent("stop", { stopId })
        }
    }

    private sendMediaMessage (message: string | {}) {
        this.interface.sendMessage(
                "urn:x-cast:com.google.cast.media"
              , message
              , null, null);
    }

    private sendMessageEvent (eventType: string, data?: {}) {
        const ev = new CustomEvent(eventType, {
            detail: {
                id: this.id
              , data
            }
        });

        this.dispatchEvent(ev);
    }


    public getInterface () {
        return this.interface;
    }

    public setConnected (
            sessionId: Session["sessionId"]
          , namespaces: Session["namespaces"]
          , displayName: Session["displayName"]
          , statusText: Session["statusText"]) {

        this.interface.status = SessionStatus.CONNECTED;
        this.interface.sessionId = sessionId;
        this.interface.namespaces = namespaces;
        this.interface.displayName = displayName;
        this.interface.statusText = statusText;

        this.sendMessageEvent("connected");
    }

    public updateStatus (data) {
        if (data.volume) {
            if (!this.interface.receiver.volume) {
                const receiverVolume = new Volume(
                        data.volume.level
                      , data.volume.muted);

                receiverVolume.controlType = data.volume.controlType;
                receiverVolume.stopInterval = data.volume.stepInterval;

                this.interface.receiver.volume = receiverVolume;
            } else {
                this.receiver.volume.level = data.volume.level;
                this.receiver.volume.muted = data.volume.muted;
            }
        }
    }

    public setStopped () {
        this.interface.status = SessionStatus.STOPPED;

        for (const listener of this.updateListeners) {
            listener(false);
        }
    }


    public impl_addMessageListener (namespace: string, data: string) {
        for (const listener of this.messageListeners.get(namespace)) {
            listener(namespace, data);
        }

        break;
    }

    public impl_sendMessage (messageId: string, error: boolean) {
        const [ successCallback, errorCallback ]
                = this.sendMessageCallbacks.get(messageId);

        if (error && errorCallback) {
            errorCallback(new _Error(ErrorCode.SESSION_ERROR));
        } else if (successCallback) {
            successCallback();
        }

        this.sendMessageCallbacks.delete(messageId);
    }

    public impl_setReceiverMuted (volumeId: string, error: boolean) {
        const [ successCallback, errorCallback ]
                = this.setReceiverMutedCallbacks.get(volumeId);

        if (error && errorCallback) {
            errorCallback(new _Error(ErrorCode.SESSION_ERROR));
        } else if (successCallback) {
            successCallback();
        }

        this.setReceiverMutedCallbacks.delete(volumeId);
    }

    public impl_setReceiverVolumeLevel (volumeId: string, error: boolean) {
        const [ successCallback, errorCallback ]
                = this.setReceiverVolumeLevelCallbacks.get(volumeId);

        if (error && errorCallback) {
            errorCallback(new _Error(ErrorCode.SESSION_ERROR));
        } else if (successCallback) {
            successCallback();
        }

        this.setReceiverVolumeLevelCallbacks.delete(volumeId);
    }

    public impl_stop (stopId: string, error: boolean) {
        const [ successCallback, errorCallback ]
                = this.stopCallbacks.get(stopId);

        if (error && errorCallback) {
            errorCallback(new _Error(ErrorCode.SESSION_ERROR));
        } else {
            this.interface.status = SessionStatus.STOPPED;

            for (const listener of this.updateListeners) {
                listener(false);
            }

            if (successCallback) {
                successCallback();
            }
        }

        this.stopCallbacks.delete(stopId);
    }
}

class {


        onMessage(message => {
            // Filter other session messages
            if (message._id && message._id !== this._id) {
                return;
            }

            switch (message.subject) {

                case "shim:/session/impl_stop": {
                    const { stopId, error } = message.data;
                    const [ successCallback, errorCallback ]
                            = this._stopCallbacks.get(stopId);

                    if (error && errorCallback) {
                        errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                    } else {
                        this.status = SessionStatus.STOPPED;
                        this._updateListeners.forEach(listener => listener());

                        if (successCallback) {
                            successCallback();
                        }
                    }

                    this._stopCallbacks.delete(stopId);

                    break;
                };
            }
        });
    }

}
