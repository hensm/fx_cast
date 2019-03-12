"use strict";

import uuid from "uuid/v1";

import _Error from "./Error";
import Image from "./Image";
import Receiver from "./Receiver";
import SenderApplication from "./SenderApplication";
import Volume from "./Volume";

import LoadRequest from "../../media/classes/LoadRequest";
import Media from "../../media/classes/Media";
import QueueLoadRequest from "../../media/classes/QueueLoadRequest";

import { ErrorCode
       , SessionStatus
       , VolumeControlType } from "../enums";

import { onMessage, sendMessageResponse } from "../../messageBridge";

import { Callbacks
       , CallbacksMap
       , ErrorCallback
       , LoadSuccessCallback
       , MediaListener
       , MessageListener
       , SuccessCallback
       , UpdateListener } from "../../types";


export default class Session {
    public media: Media[];
    public namespaces: Array<{ name: "string" }>;
    public senderApps: SenderApplication[];
    public status: string;
    public statusText: string;
    public transportId: string;


    private _id: string = uuid();
    private _messageListeners = new Map<string, Set<MessageListener>>();
    private _updateListeners = new Set<UpdateListener>();

    private _leaveCallbacks: CallbacksMap = new Map();
    private _sendMessageCallbacks: CallbacksMap = new Map();
    private _setReceiverMutedCallbacks: CallbacksMap = new Map();
    private _setReceiverVolumeLevelCallbacks: CallbacksMap = new Map();
    private _stopCallbacks: CallbacksMap = new Map();

    constructor (
            public sessionId: string
          , public appId: string
          , public displayName: string
          , public appImages: Image[]
          , public receiver: Receiver
          , _successCallback: (session: Session) => void) {

        this.media = [];
        this.namespaces = [];
        this.senderApps = [];
        this.status = SessionStatus.CONNECTED;
        this.statusText = null;
        this.transportId = sessionId || "";

        if (receiver) {
            this._sendMessage("bridge:/session/initialize", {
                address: (receiver as any)._address
              , port: (receiver as any)._port
              , appId
              , sessionId
            });
        }

        onMessage(message => {
            // Filter other session messages
            if (message._id && message._id !== this._id) {
                return;
            }

            switch (message.subject) {
                case "shim:/session/stopped": {
                    this.status = SessionStatus.STOPPED;

                    for (const listener of this._updateListeners) {
                        listener(false);
                    }

                    break;
                }

                case "shim:/session/connected": {
                    this.status = SessionStatus.CONNECTED;
                    this.sessionId = message.data.sessionId;
                    this.namespaces = message.data.namespaces;
                    this.displayName = message.data.displayName;
                    this.statusText = message.data.statusText;

                    if (_successCallback) {
                        _successCallback(this);
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

                    break;
                }


                case "shim:/session/impl_addMessageListener": {
                    const { namespace, data } = message.data;
                    for (const listener of
                            this._messageListeners.get(namespace)) {
                        listener(namespace, data);
                    }

                    break;
                }

                case "shim:/session/impl_sendMessage": {
                    const { messageId, error } = message.data;
                    const [ successCallback, errorCallback ]
                            = this._sendMessageCallbacks.get(messageId);

                    if (error && errorCallback) {
                        errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                    } else if (successCallback) {
                        successCallback();
                    }

                    this._sendMessageCallbacks.delete(messageId);

                    break;
                }

                case "shim:/session/impl_setReceiverMuted": {
                    const { volumeId, error } = message.data;
                    const [ successCallback, errorCallback ]
                            = this._setReceiverMutedCallbacks.get(volumeId);

                    if (error && errorCallback) {
                        errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                    } else if (successCallback) {
                        successCallback();
                    }

                    this._setReceiverMutedCallbacks.delete(volumeId);

                    break;
                }

                case "shim:/session/impl_setReceiverVolumeLevel": {
                    const { volumeId, error } = message.data;
                    const [ successCallback, errorCallback ]
                            = this._setReceiverVolumeLevelCallbacks
                                .get(volumeId);

                    if (error && errorCallback) {
                        errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                    } else if (successCallback) {
                        successCallback();
                    }

                    this._setReceiverVolumeLevelCallbacks.delete(volumeId);

                    break;
                }

                case "shim:/session/impl_stop": {
                    const { stopId, error } = message.data;
                    const [ successCallback, errorCallback ]
                            = this._stopCallbacks.get(stopId);

                    if (error && errorCallback) {
                        errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                    } else {
                        this.status = SessionStatus.STOPPED;

                        for (const listener of this._updateListeners) {
                            listener(false);
                        }

                        if (successCallback) {
                            successCallback();
                        }
                    }

                    this._stopCallbacks.delete(stopId);

                    break;
                }
            }
        });
    }


    public addMediaListener (listener: MediaListener) {
        console.info("STUB :: Session#addMediaListener");
    }

    public addMessageListener (
            namespace: string
          , listener: MessageListener) {

        if (!this._messageListeners.has(namespace)) {
            this._messageListeners.set(namespace, new Set());
        }
        this._messageListeners.get(namespace).add(listener);
        this._sendMessage("bridge:/session/impl_addMessageListener", {
            namespace
        });
    }

    public addUpdateListener (listener: UpdateListener) {
        this._updateListeners.add(listener);
    }

    public leave (
            successCallback: SuccessCallback
          , errorCallback: ErrorCallback): void {

        const id = uuid();

        this._sendMessage("bridge:/session/impl_leave", { id });

        this._leaveCallbacks.set(id, [
            successCallback
          , errorCallback
        ]);
    }

    public loadMedia (
            loadRequest: LoadRequest
          , successCallback: LoadSuccessCallback
          , errorCallback: ErrorCallback): void {

        this._sendMediaMessage({
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

        this.addMessageListener(
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
        });
    }

    public queueLoad (
            queueLoadRequest: QueueLoadRequest
          , successCallback: LoadSuccessCallback
          , errorCallback: ErrorCallback): void {

        console.info("STUB :: Session#queueLoad");
    }

    public removeMediaListener (listener: MediaListener): void {
        console.info("STUB :: Session#removeMediaListener");
    }

    public removeMessageListener (
            namespace: string
          , listener: MessageListener): void {

        this._messageListeners.get(namespace).delete(listener);
    }

    public removeUpdateListener (
            namespace: string
          , listener: UpdateListener): void {

        this._updateListeners.delete(listener);
    }

    public sendMessage (
            namespace: string
          , message: {} | string
          , successCallback: SuccessCallback
          , errorCallback: ErrorCallback): void {

        const messageId = uuid();

        this._sendMessage("bridge:/session/impl_sendMessage", {
            namespace
          , message
          , messageId
        });

        this._sendMessageCallbacks.set(messageId, [
            successCallback
          , errorCallback
        ]);
    }

    public setReceiverMuted (
            muted: boolean
          , successCallback: SuccessCallback
          , errorCallback: ErrorCallback) {

        const volumeId = uuid();

        this._sendMessage("bridge:/session/impl_setReceiverMuted", {
            muted
          , volumeId
        });

        this._setReceiverMutedCallbacks.set(volumeId, [
            successCallback
          , errorCallback
        ]);
    }

    public setReceiverVolumeLevel (
            newLevel: number
          , successCallback: SuccessCallback
          , errorCallback: ErrorCallback): void {

        const volumeId = uuid();
        this._sendMessage("bridge:/session/impl_setReceiverVolumeLevel", {
            newLevel
          , volumeId
        });

        this._setReceiverVolumeLevelCallbacks.set(volumeId, [
            successCallback
          , errorCallback
        ]);
    }

    public stop (
            successCallback: SuccessCallback
          , errorCallback: ErrorCallback): void {

        const stopId = uuid();
        this._sendMessage("bridge:/session/impl_stop", { stopId });

        this._stopCallbacks.set(stopId, [
            successCallback
          , errorCallback
        ]);
    }


    private _sendMessage (subject: string, data = {}) {
        sendMessageResponse({
            subject
          , data
          , _id: this._id
        });
    }

    private _sendMediaMessage (message: string | {}) {
        this.sendMessage(
                "urn:x-cast:com.google.cast.media"
              , message
              , null, null);
    }
}
