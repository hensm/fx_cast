"use strict";

import uuid from "uuid/v1";

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

import { CallbacksMap
       , ErrorCallback
       , LoadSuccessCallback
       , MediaListener
       , MessageListener
       , SuccessCallback
       , UpdateListener } from "../../types";


const _id = new WeakMap<Session, string>();
const _listener = new WeakMap<Session, ListenerObject>();

const _messageListeners = new WeakMap<
        Session, Map<string, Set<MessageListener>>>();

const _updateListeners = new WeakMap<Session, Set<UpdateListener>>();

const _leaveCallbacks = new WeakMap<Session, CallbacksMap>();
const _sendMessageCallbacks = new WeakMap<Session, CallbacksMap>();
const _setReceiverMutedCallbacks = new WeakMap<Session, CallbacksMap>();
const _setReceiverVolumeLevelCallbacks = new WeakMap<Session, CallbacksMap>();
const _stopCallbacks = new WeakMap<Session, CallbacksMap>();


export default class Session {
    public media: Media[];
    public namespaces: Array<{ name: "string" }>;
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
          , _successCallback: (session: Session) => void) {

        _id.set(this, uuid());

        _messageListeners.set(this, new Map());
        _updateListeners.set(this, new Set());

        _leaveCallbacks.set(this, new Map());
        _sendMessageCallbacks.set(this, new Map());
        _setReceiverMutedCallbacks.set(this, new Map());
        _setReceiverVolumeLevelCallbacks.set(this, new Map());
        _stopCallbacks.set(this, new Map());


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
                }
              , _id: _id.get(this)
            });
        }

        const listenerObject = onMessage(message => {
            // Filter other session messages
            if (message._id && message._id !== _id.get(this)) {
                return;
            }

            switch (message.subject) {
                case "shim:/session/stopped": {
                    // Disconnect from extension messages
                    _listener.get(this)?.disconnect();

                    this.status = SessionStatus.STOPPED;

                    const updateListeners = _updateListeners.get(this);
                    if (updateListeners) {
                        for (const listener of updateListeners) {
                            listener(false);
                        }
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

                    const updateListeners = _updateListeners.get(this);
                    if (updateListeners) {
                        for (const listener of updateListeners) {
                            listener(true);
                        }
                    }

                    break;
                }


                case "shim:/session/impl_addMessageListener": {
                    const { namespace, data }
                        : { namespace: string, data: string } = message.data;

                    const messageListeners = _messageListeners
                            .get(this)?.get(namespace);

                    if (messageListeners) {
                        for (const listener of messageListeners) {
                            listener(namespace, data);
                        }
                    }

                    break;
                }

                case "shim:/session/impl_sendMessage": {
                    const { messageId, error }
                        : { messageId: string, error: boolean } = message.data;

                    const [ successCallback, errorCallback ] =
                            _sendMessageCallbacks
                                .get(this)?.get(messageId) ?? [];

                    if (error && errorCallback) {
                        errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                    } else if (successCallback) {
                        successCallback();
                    }

                    _sendMessageCallbacks.get(this)?.delete(messageId);

                    break;
                }

                case "shim:/session/impl_setReceiverMuted": {
                    const { volumeId, error } = message.data;
                    const [ successCallback, errorCallback ] =
                            _setReceiverMutedCallbacks
                                .get(this)?.get(volumeId) ?? [];

                    if (error && errorCallback) {
                        errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                    } else if (successCallback) {
                        successCallback();
                    }

                    _setReceiverMutedCallbacks.get(this)?.delete(volumeId);

                    break;
                }

                case "shim:/session/impl_setReceiverVolumeLevel": {
                    const { volumeId, error } = message.data;
                    const [ successCallback, errorCallback ] =
                            _setReceiverVolumeLevelCallbacks
                                .get(this)?.get(volumeId) ?? [];

                    if (error && errorCallback) {
                        errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                    } else if (successCallback) {
                        successCallback();
                    }

                    _setReceiverVolumeLevelCallbacks
                        .get(this)?.delete(volumeId);

                    break;
                }

                case "shim:/session/impl_stop": {
                    const { stopId, error } = message.data;
                    const [ successCallback, errorCallback ]
                            = _stopCallbacks.get(this)?.get(stopId) ?? [];

                    // Disconnect from extension messages
                    _listener.get(this)?.disconnect();

                    if (error && errorCallback) {
                        errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                    } else {
                        this.status = SessionStatus.STOPPED;

                        const updateListeners = _updateListeners.get(this);
                        if (updateListeners) {
                            for (const listener of updateListeners) {
                                listener(false);
                            }
                        }

                        if (successCallback) {
                            successCallback();
                        }
                    }

                    _stopCallbacks.get(this)?.delete(stopId);

                    break;
                }
            }
        });

        _listener.set(this, listenerObject);
    }


    public addMediaListener (_mediaListener: MediaListener) {
        logger.info("STUB :: Session#addMediaListener");
    }

    public addMessageListener (
            namespace: string
          , listener: MessageListener) {

        if (!_messageListeners.get(this)?.has(namespace)) {
            _messageListeners.get(this)?.set(namespace, new Set());
        }

        _messageListeners.get(this)?.get(namespace)?.add(listener);

        sendMessageResponse({
            subject: "bridge:/session/impl_addMessageListener"
          , data: { namespace }
          , _id: _id.get(this)
        });
    }

    public addUpdateListener (listener: UpdateListener) {
        _updateListeners.get(this)?.add(listener);
    }

    public leave (
            successCallback: SuccessCallback
          , errorCallback: ErrorCallback): void {

        const id = uuid();

        sendMessageResponse({
            subject: "bridge:/session/impl_leave"
          , data: { id }
          , _id: _id.get(this)
        });

        _leaveCallbacks.get(this)?.set(id, [
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
                const sessionId = _id.get(this);
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
          , _successCallback: LoadSuccessCallback
          , _errorCallback: ErrorCallback): void {

        logger.info("STUB :: Session#queueLoad");
    }

    public removeMediaListener (_mediaListener: MediaListener): void {
        logger.info("STUB :: Session#removeMediaListener");
    }

    public removeMessageListener (
            namespace: string
          , listener: MessageListener): void {

        _messageListeners.get(this)?.get(namespace)?.delete(listener);
    }

    public removeUpdateListener (
            _namespace: string
          , listener: UpdateListener): void {

        _updateListeners.get(this)?.delete(listener);
    }

    public sendMessage (
            namespace: string
          , message: {} | string
          , successCallback: SuccessCallback
          , errorCallback: ErrorCallback): void {

        const messageId = uuid();

        sendMessageResponse({
            subject: "bridge:/session/impl_sendMessage"
          , data: {
                namespace
              , message
              , messageId
            }
          , _id: _id.get(this)
        });

        _sendMessageCallbacks.get(this)?.set(messageId, [
            successCallback
          , errorCallback
        ]);
    }

    public setReceiverMuted (
            muted: boolean
          , successCallback: SuccessCallback
          , errorCallback: ErrorCallback) {

        const volumeId = uuid();

        sendMessageResponse({
            subject: "bridge:/session/impl_setReceiverMuted"
          , data: { muted, volumeId }
          , _id: _id.get(this)
        });

        _setReceiverMutedCallbacks.get(this)?.set(volumeId, [
            successCallback
          , errorCallback
        ]);
    }

    public setReceiverVolumeLevel (
            newLevel: number
          , successCallback: SuccessCallback
          , errorCallback: ErrorCallback): void {

        const volumeId = uuid();

        sendMessageResponse({
            subject: "bridge:/session/impl_setReceiverVolumeLevel"
          , data: { newLevel, volumeId }
          , _id: _id.get(this)
        });

        _setReceiverVolumeLevelCallbacks.get(this)?.set(volumeId, [
            successCallback
          , errorCallback
        ]);
    }

    public stop (
            successCallback: SuccessCallback
          , errorCallback: ErrorCallback): void {

        const stopId = uuid();

        sendMessageResponse({
            subject: "bridge:/session/impl_stop"
          , data: { stopId }
          , _id: _id.get(this)
        });

        _stopCallbacks.get(this)?.set(stopId, [
            successCallback
          , errorCallback
        ]);
    }


    private _sendMediaMessage (message: string | {}) {
        this.sendMessage(
                "urn:x-cast:com.google.cast.media"
              , message
              , () => {}, () => {});
    }
}
