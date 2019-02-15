"use strict";

import _Error   from "./Error";
import Volume   from "./Volume";
import Media    from "../../media/classes/Media";

import { SessionStatus
       , ErrorCode
       , VolumeControlType } from "../enums";

import { onMessage, sendMessageResponse } from "../../messageBridge";

import uuid from "uuid/v1";


export default class Session {
    constructor (
            sessionId
          , appId
          , displayName
          , appImages
          , receiver
          , successCallback) {

        this._id = uuid();
        this._messageListeners = new Map();
        this._updateListeners = new Set();

        this._sendMessageCallbacks = new Map();
        this._setReceiverMutedCallbacks = new Map();
        this._setReceiverVolumeLevelCallbacks = new Map();
        this._stopCallbacks = new Map();

        this.sessionId = sessionId;
        this.transportId = sessionId || "";
        this.appId = appId;
        this.appImages = appImages;
        this.displayName = displayName;
        this.receiver = receiver;

        this.media = [];
        this.namespaces = [];
        this.senderApps = [];
        this.status = SessionStatus.CONNECTED;
        this.statusText = null;

        if (receiver) {
            this._sendMessage("bridge:/session/initialize", {
                address: receiver._address
              , port: receiver._port
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
                    this._updateListeners.forEach(listener => listener());

                    break;
                };

                case "shim:/session/connected": {
                    this.status = SessionStatus.CONNECTED;
                    this.sessionId = message.data.sessionId;
                    this.namespaces = message.data.namespaces;
                    this.displayName = message.data.displayName;
                    this.statusText = message.data.statusText;

                    if (successCallback) {
                        successCallback(this);
                    }

                    break;
                };

                case "shim:/session/updateStatus": {
                    if (message.data.volume) {
                        if (!this.receiver.volume) {
                            const receiverVolume = new Volume(
                                    message.data.volume.level
                                  , message.data.volume.muted);

                            receiverVolume.controlType = message.data.volume.controlType;
                            receiverVolume.stepInterval = message.data.volume.stepInterval;

                            this.receiver.volume = receiverVolume;
                        } else {
                            this.receiver.volume.level = message.data.volume.level;
                            this.receiver.volume.muted = message.data.volume.muted;
                        }
                    }

                    break;
                };


                case "shim:/session/impl_addMessageListener": {
                    const { namespace, data } = message.data;
                    this._messageListeners.get(namespace).forEach(
                            listener => listener(namespace, data));
                    break;
                };

                case "shim:/session/impl_sendMessage": {
                    const { messageId, error } = message.data;
                    const [ successCallback, errorCallback ]
                            = this._sendMessageCallbacks.get(messageId)

                    if (error && errorCallback) {
                        errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                    } else if (successCallback) {
                        successCallback();
                    }

                    this._sendMessageCallbacks.delete(messageId);

                    break;
                };

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
                };

                case "shim:/session/impl_setReceiverVolumeLevel": {
                    const { volumeId, error } = message.data;
                    const [ successCallback, errorCallback ]
                            = this._setReceiverVolumeLevelCallbacks.get(volumeId);

                    if (error && errorCallback) {
                        errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                    } else if (successCallback) {
                        successCallback();
                    }

                    this._setReceiverVolumeLevelCallbacks.delete(volumeId);

                    break;
                };

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

    _sendMessage (subject, data = {}) {
        sendMessageResponse({
            subject
          , data
          , _id: this._id
        });
    }


    addMediaListener (listener) {
        console.info("STUB :: Session#addMediaListener")
    }

    addMessageListener (namespace, listener) {
        if (!this._messageListeners.has(namespace)) {
            this._messageListeners.set(namespace, new Set());
        }
        this._messageListeners.get(namespace).add(listener);
        this._sendMessage("bridge:/session/impl_addMessageListener", {
            namespace
        });
    }

    addUpdateListener (listener) {
        this._updateListeners.add(listener);
    }

    leave (successCallback, errorCallback) {
        const id = uuid();

        this._sendMessage("bridge:/session/impl_leave", { id });

        this._leaveCallbacks.set(id, [
            successCallback
          , errorCallback
        ]);
    }

    loadMedia (loadRequest, successCallback, errorCallback) {
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

        this.addMessageListener("urn:x-cast:com.google.cast.media"
              , (namespace, data) => {
            if (hasResponded) return;

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

    queueLoad () {
        console.info("STUB :: Session#queueLoad");
    }
    removeMediaListener (listener) {
        console.info("STUB :: Session#removeMediaListener");
    }
    removeMessageListener (namespace, listener) {
        this._messageListeners.get(namespace).delete(listener);
    }
    removeUpdateListener (namespace, listener) {
        this._updateListeners.delete(listener);
    }

    sendMediaMessage (message) {
        this.sendMessage(
                "urn:x-cast:com.google.cast.media"
              , message
              , () => {}
              , () => {});
    }

    sendMessage (namespace, message, successCallback, errorCallback) {
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

    setReceiverMuted (muted, successCallback, errorCallback) {
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

    setReceiverVolumeLevel (newLevel, successCallback, errorCallback) {
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

    stop (successCallback, errorCallback) {
        const stopId = uuid();
        this._sendMessage("bridge:/session/impl_stop", { stopId });

        this._stopCallbacks.set(stopId, [
            successCallback
          , errorCallback
        ]);
    }
}
