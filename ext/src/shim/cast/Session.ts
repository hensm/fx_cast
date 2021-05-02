"use strict";

import { v4 as uuid } from "uuid";

import logger from "../../lib/logger";

import { sendMessageResponse } from "../eventMessageChannel";

import { ErrorCallback
       , LoadSuccessCallback
       , MediaListener
       , MessageListener
       , SuccessCallback
       , UpdateListener } from "../types";

import { ReceiverMediaMessage, SenderMediaMessage, SenderMessage } from "./types";

import { Error as Error_
       , Image, Receiver
       , SenderApplication } from "./dataClasses";
import { SessionStatus } from "./enums";
import { Media, LoadRequest, QueueLoadRequest } from "./media";


const NS_MEDIA = "urn:x-cast:com.google.cast.media";

export default class Session {
    #id = uuid();

    #isConnected = false;

    #loadMediaSuccessCallback?: (media: Media) => void;
    #loadMediaErrorCallback?: ErrorCallback;
    #loadMediaRequest?: LoadRequest;

    _messageListeners = new Map<string, Set<MessageListener>>();
    _updateListeners = new Set<UpdateListener>();


    _sendMessageCallbacks =
            new Map<string, [ SuccessCallback?, ErrorCallback? ]>();

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
                            media => media.mediaSessionId ===
                                     mediaStatus.mediaSessionId);
                    if (!media) {
                        media = new Media(
                                // TODO: Change to status session id?
                                this.sessionId
                              , mediaStatus.mediaSessionId
                              , this.#sendMediaMessage);
                        
                        this.media.push(media);
                    }

                    //updateMedia(media, mediaStatus);

                    //for (const )

                    break;
                }
            }
        }
    }

    /**
     * Sends a media message to the app receiver.
     * urn:x-cast:com.google.cast.media
     */
    #sendMediaMessage = (message: DistributiveOmit<
            SenderMediaMessage, "requestId">) => {
        
        return new Promise<void>((resolve, reject) => {
            this.sendMessage(
                    "urn:x-cast:com.google.cast.media"
                  , { ...message, requestId: 0 }
                  , resolve, reject);

        });
    }

    #sendReceiverMessage = (message: DistributiveOmit<
            SenderMessage, "requestId">) => {

        return new Promise<void>((resolve, reject) => {
            const messageId = uuid();

            sendMessageResponse({
                subject: "bridge:sendCastReceiverMessage"
              , data: {
                    sessionId: this.sessionId
                  , messageData: message as SenderMessage
                  , messageId
                }
            });

            this._sendMessageCallbacks.set(
                    messageId, [ resolve, reject ]);
        });
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
              , public receiver: Receiver) {

        this.transportId = sessionId || "";
    }


    addMediaListener(_mediaListener: MediaListener) {
        logger.info("STUB :: Session#addMediaListener");
    }
    removeMediaListener(_mediaListener: MediaListener): void {
        logger.info("STUB :: Session#removeMediaListener");
    }

    addMessageListener(namespace: string, listener: MessageListener) {
        if (!this._messageListeners.has(namespace)) {
            this._messageListeners.set(namespace, new Set());
        }

        this._messageListeners.get(namespace)?.add(listener);
    }
    removeMessageListener(namespace: string, listener: MessageListener): void {
        this._messageListeners.get(namespace)?.delete(listener);
    }

    addUpdateListener(listener: UpdateListener) {
        this._updateListeners.add(listener);
    }
    removeUpdateListener(listener: UpdateListener): void {
        this._updateListeners.delete(listener);
    }

    leave(_successCallback?: SuccessCallback
        , _errorCallback?: ErrorCallback): void {

        logger.info("STUB :: Session#leave");
    }

    loadMedia(loadRequest: LoadRequest
            , successCallback?: LoadSuccessCallback
            , errorCallback?: ErrorCallback): void {

        this.#loadMediaSuccessCallback = successCallback;
        this.#loadMediaErrorCallback = errorCallback;
        this.#loadMediaRequest = loadRequest;

        loadRequest.sessionId = this.sessionId;
        this.#sendMediaMessage(loadRequest)
            .catch(errorCallback);
    }

    queueLoad(_queueLoadRequest: QueueLoadRequest
            , _successCallback?: LoadSuccessCallback
            , _errorCallback?: ErrorCallback): void {

        logger.info("STUB :: Session#queueLoad");
    }

    sendMessage(namespace: string
              , message: object | string
              , successCallback?: SuccessCallback
              , errorCallback?: ErrorCallback): void {

        const messageId = uuid();

        sendMessageResponse({
            subject: "bridge:sendCastSessionMessage"
          , data: {
                sessionId: this.sessionId
              , namespace
              , messageData: message
              , messageId
            }
        });

        this._sendMessageCallbacks.set(messageId, [
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
