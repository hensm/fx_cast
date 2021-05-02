"use strict";

import logger from "../../lib/logger";

import { ReceiverDevice } from "../../types";

import { onMessage, sendMessageResponse } from "../eventMessageChannel";

import Session from "./Session";

import { ApiConfig
       , Error as Error_
       , Image as Image_
       , Receiver
       , SessionRequest
       , Timeout } from "./dataClasses";

import { ErrorCode
       , ReceiverAction
       , ReceiverAvailability
       , SessionStatus } from "./enums";

import { PlayerState } from "./media/enums";
import { QueueItem } from "./media/dataClasses";

import Media from "./media/Media";

import { CastSessionUpdate, MediaStatus } from "./types";


export * from "./enums";
export * from "./dataClasses";

export * as media from "./media";

export {
    Session

  , Error_ as Error
  , Image_ as Image
  , Receiver as Receiver
};

export let isAvailable = false;
export const timeout = new Timeout();
export const VERSION = [ 1, 2 ];


type ReceiverActionListener = (
        receiver: Receiver
      , receiverAction: string) => void;

type RequestSessionSuccessCallback = (session: Session) => void;

type SuccessCallback = () => void;
type ErrorCallback = (err: Error_) => void;


let apiConfig: ApiConfig;

const receiverDevices = new Map<string, ReceiverDevice>();
const sessions = new Map<string, Session>();

const receiverActionListeners = new Set<ReceiverActionListener>();

let sessionRequestInProgress = false;
let sessionSuccessCallback: RequestSessionSuccessCallback;
let sessionErrorCallback: ErrorCallback;


export function addReceiverActionListener(
        listener: ReceiverActionListener): void {

    receiverActionListeners.add(listener);
}

export function initialize(
        newApiConfig: ApiConfig
      , successCallback?: SuccessCallback
      , errorCallback?: ErrorCallback): void {

    logger.info("cast.initialize");

    // Already initialized
    if (apiConfig) {
        if (errorCallback) {
            errorCallback(new Error_(ErrorCode.INVALID_PARAMETER));
        }

        return;
    }


    apiConfig = newApiConfig;

    sendMessageResponse({
        subject: "main:shimReady"
      , data: { appId: apiConfig.sessionRequest.appId }
    });

    if (successCallback) {
        successCallback();
    }

    apiConfig.receiverListener(receiverDevices.size
        ? ReceiverAvailability.AVAILABLE
        : ReceiverAvailability.UNAVAILABLE);
}

export function logMessage(message: string): void {
    // eslint-disable-next-line no-console
    console.log("CAST MSG:", message);
}

export function precache(_data: string): void {
    logger.info("STUB :: cast.precache");
}

export function removeReceiverActionListener(
        listener: ReceiverActionListener): void {

    receiverActionListeners.delete(listener);
}

export function requestSession(
        successCallback: RequestSessionSuccessCallback
      , errorCallback: ErrorCallback
      , _sessionRequest: SessionRequest = apiConfig.sessionRequest): void {

    logger.info("cast.requestSession");

    // Called before initialization
    if (!apiConfig) {
        errorCallback?.(new Error_(ErrorCode.API_NOT_INITIALIZED));
        return;
    }

    // Already requesting session
    if (sessionRequestInProgress) {
        errorCallback?.(new Error_(
                ErrorCode.INVALID_PARAMETER
              , "Session request already in progress."));
        return;
    }

    // No available receivers
    if (!receiverDevices.size) {
        errorCallback?.(new Error_(ErrorCode.RECEIVER_UNAVAILABLE));
        return;
    }

    sessionRequestInProgress = true;

    sessionSuccessCallback = successCallback;
    sessionErrorCallback = errorCallback;

    // Open receiver selector UI
    sendMessageResponse({
        subject: "main:selectReceiver"
    });
}

export function requestSessionById(_sessionId: string): void {
    logger.info("STUB :: cast.requestSessionById");
}

export function setCustomReceivers(
        _receivers: Receiver[]
      , _successCallback?: SuccessCallback
      , _errorCallback?: ErrorCallback): void {

    logger.info("STUB :: cast.setCustomReceivers");
}

export function setPageContext(_win: Window): void {
    logger.info("STUB :: cast.setPageContext");
}

export function setReceiverDisplayStatus(_sessionId: string): void {
    logger.info("STUB :: cast.setReceiverDisplayStatus");
}

export function unescape(escaped: string): string {
    return decodeURI(escaped);
}


/**
 * Handle session object creation and updates.
 */
function updateSession(update: CastSessionUpdate) {
    const { application } = update;
    const { sessionId } = application;

    const session = sessions.get(sessionId);
    if (!session) {
        logger.error(`Session not found (${sessionId})`);
        return;
    }

    sessions.set(sessionId, session);
    return session;
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
        if (prop !== "items" && status.hasOwnProperty(prop)) {
            (media as any)[prop] = (status as any)[prop];
        }
    }

    // Update queue state
    if (status.items) {
        const newItems: QueueItem[] = [];

        for (const newItem of status.items) {
            if (!newItem.media) {
                // Existing queue item with the same ID
                const existingItem = media.items?.find(
                        item => item.itemId === newItem.itemId);

                /**
                 * Use existing queue item's media info if available
                 * otherwise, if the current queue item, use the main
                 * media item.
                 */
                if (existingItem?.media) {
                    newItem.media = existingItem.media;
                } else if (media.media
                      && newItem.itemId === media.currentItemId) {
                    newItem.media = media.media;
                }
            }
        }

        media.items = newItems;
    }
}


onMessage(async message => {
    switch (message.subject) {
        case "shim:initialized": {
            isAvailable = true;
            break;
        }

        case "shim:castSessionCreated": {
            const { sessionId
                  , receiverDevice
                  , application
                  , volume } = message.data;

            // TODO: Implement persistent per-origin receiver IDs
            const receiver = new Receiver(
                    ""                           // label
                  , receiverDevice.friendlyName  // friendlyName
                  , undefined                    // capabilities
                  , volume);                     // volume

            const session = new Session(
                    sessionId                // sessionId
                  , application.appId        // appId
                  , application.displayName  // displayName
                  , []                       // senderApps
                  , receiver);               // receiver

            session.sessionId = sessionId;
            session.namespaces = application.namespaces;
            session.displayName = application.displayName;
            session.receiver.volume = volume;
            session.statusText = application.statusText;

            // Success callback
            if (sessionSuccessCallback) {
                sessionSuccessCallback(session);
            }

            sessions.set(sessionId, session);

            // Notify background to close UI
            sendMessageResponse({
                subject: "main:sessionCreated"
            });
        }
        // eslint-disable-next-line no-fallthrough
        case "shim:castSessionUpdated": {
            updateSession(message.data);
            break;
        }

        case "shim:castSessionStopped": {
            const { sessionId } = message.data;
            const session = sessions.get(sessionId);
            if (session) {
                session.status = SessionStatus.STOPPED;

                for (const listener of session?._updateListeners) {
                    listener(false);
                }
            }

            break;
        }

        case "shim:receivedCastSessionMessage": {
            const { sessionId, namespace, messageData } = message.data;
            
            const session = sessions.get(sessionId);
            if (session) {
                const _messageListeners = session._messageListeners;
                const namespaceListeners = _messageListeners.get(namespace);

                if (namespaceListeners) {
                    for (const listener of namespaceListeners) {
                        listener(namespace, messageData);
                    }
                }
            }

            break;
        }

        case "shim:impl_sendCastMessage": {
            const { sessionId, messageId, error } = message.data;

            const session = sessions.get(sessionId);
            if (session) {
                const callbacks = session._sendMessageCallbacks.get(messageId);
                if (callbacks) {
                    const [ successCallback, errorCallback ] = callbacks;
                    
                    if (error) {
                        errorCallback?.(new Error_(error));
                        return;
                    }

                    successCallback?.();
                }
            }

            break;
        }

        /**
         * Cast destination found (serviceUp). Set the API availability
         * property and call the page event function (__onGCastApiAvailable).
         */
        case "shim:serviceUp": {
            const { receiverDevice } = message.data;
            if (receiverDevices.has(receiverDevice.id)) {
                break;
            }

            receiverDevices.set(receiverDevice.id, receiverDevice);

            if (apiConfig) {
                // Notify listeners of new cast destination
                apiConfig.receiverListener(ReceiverAvailability.AVAILABLE);
            }

            break;
        }

        /**
         * Cast destination lost (serviceDown). Remove from the receiver list
         * and update availability state.
         */
        case "shim:serviceDown": {
            const { receiverDeviceId } = message.data;

            receiverDevices.delete(receiverDeviceId);

            if (receiverDevices.size === 0) {
                if (apiConfig) {
                    apiConfig.receiverListener(
                            ReceiverAvailability.UNAVAILABLE);
                }
            }

            break;
        }

        case "shim:selectReceiver/selected": {
            logger.info("Selected receiver");

            if (!sessionRequestInProgress) {
                break;
            }

            const { receiver: receiverDevice } = message.data;

            for (const listener of receiverActionListeners) {
                logger.info("Calling receiver action listener", receiverDevice);

                const receiver = new Receiver(
                        receiverDevice.id
                      , receiverDevice.friendlyName);

                listener(receiver, ReceiverAction.CAST);
            }

            sendMessageResponse({
                subject: "bridge:createCastSession"
              , data: {
                    appId: apiConfig.sessionRequest.appId
                  , receiverDevice: receiverDevice
                }
            });

            break;
        }

        case "shim:selectReceiver/stopped": {
            logger.info("Stopped receiver");

            if (sessionRequestInProgress) {
                sessionRequestInProgress = false;

                for (const listener of receiverActionListeners) {
                    const castReceiver = new Receiver(
                            message.data.receiver.id
                          , message.data.receiver.friendlyName);

                    logger.info("Calling receiver action listener (STOP)"
                          , message.data.receiver);
                    listener(castReceiver, ReceiverAction.STOP);
                }
            }

            break;
        }

        /**
         * Popup closed before session established.
         */
        case "shim:selectReceiver/cancelled": {
            if (sessionRequestInProgress) {
                sessionRequestInProgress = false;

                if (sessionErrorCallback) {
                    sessionErrorCallback(new Error_(ErrorCode.CANCEL));
                }
            }

            break;
        }
    }
});
