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

import { ReceiverMediaMessage, SenderMediaMessage, SenderMessage } from "./types";

import { Error as Error_
       , Image, Receiver
       , SenderApplication, Volume } from "./dataClasses";
import { ErrorCode, SessionStatus } from "./enums";

import { Media
       , LoadRequest
       , QueueLoadRequest } from "./media";


type DistributiveOmit<T, K extends keyof any> =
        T extends any
            ? Omit<T, K>
            : never;

type SessionSuccessCallback = (session: Session) => void;


const NS_MEDIA = "urn:x-cast:com.google.cast.media";

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
                    listener(this.status !== SessionStatus.STOPPED);
                }

                break;
            }

            case "shim:session/updateStatus": {
                const { status } = message.data;

                // First status message indicates session creation
                if (!this.#isConnected && status.applications) {
                    this.#isConnected = true;

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
                    listener(this.status !== SessionStatus.STOPPED);
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
                    errorCallback(new Error_(ErrorCode.SESSION_ERROR));
                } else if (successCallback) {
                    successCallback();
                }

                this.#sendMessageCallbacks.delete(messageId);

                break;
            }

            case "shim:session/impl_sendPlatformMessage": {
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
     * Sends a message to the platform receiver.
     * receiver-0 / urn:x-cast:com.google.cast.receiver
     */
     #sendPlatformMessage = (message: DistributiveOmit<
            SenderMessage, "requestId">) => {

        const messageId = uuid();
        sendMessageResponse({
            subject: "bridge:session/impl_sendPlatformMessage"
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
                    reject(new Error_(ErrorCode.SESSION_ERROR));
                    return;
                }

                resolve();
            });
        });
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
                  , message
                  , resolve, reject);

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
        
        /**
         * When a media load (`LOAD`) request is sent, the receiver
         * sends back a media status (`MEDIA_STATUS`) message, so add a
         * media message listener that is removed on the first call to
         * provide completion handling.
         */
        const this_ = this;
        this.addMessageListener(NS_MEDIA
              , function initialMediaListener(
                        _namespace: string, messageString: string) {

            const message: ReceiverMediaMessage = JSON.parse(messageString);
            switch (message.type) {
                case "MEDIA_STATUS": {
                    this_.removeMessageListener(
                            NS_MEDIA, initialMediaListener);

                    // TODO: multiple status? (also diff between request ids)
                    const [ status ] = message.status;
                    if (!status) {
                        if (errorCallback) {
                            errorCallback(new Error_(ErrorCode.SESSION_ERROR));
                        }
                        return;
                    }

                    const media = new Media(
                            this_.sessionId         // sessionId
                          , status.mediaSessionId   // mediaSessionId
                          , this_.#id);             // _internalSessionId
                    
                    media.media = { ...loadRequest.media, ...status };
                    this_.media = [ media ];

                    media.play();

                    if (successCallback) {
                        successCallback(media);
                    }

                    break;
                }
            }
        });

        loadRequest.sessionId = this.sessionId;
        this.#sendMediaMessage(loadRequest);
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

        this.#sendPlatformMessage(
                { type: "SET_VOLUME"
                , volume: { muted }})
            .then(successCallback)
            .catch(errorCallback);
    }

    setReceiverVolumeLevel(newLevel: number
                         , successCallback?: SuccessCallback
                         , errorCallback?: ErrorCallback): void {

        this.#sendPlatformMessage(
                { type: "SET_VOLUME"
                , volume: { level: newLevel }})
            .then(successCallback)
            .catch(errorCallback);
    }

    stop(successCallback?: SuccessCallback
       , errorCallback?: ErrorCallback): void {

        this.#sendPlatformMessage(
                { type: "STOP"
                , sessionId: this.sessionId })
            .then(successCallback)
            .catch(errorCallback);
    }
}
