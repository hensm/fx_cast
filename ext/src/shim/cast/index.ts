"use strict";

import logger from "../../lib/logger";

import { ReceiverDevice } from "../../types";
import { onMessage, sendMessageResponse } from "../eventMessageChannel";

import Session from "./Session";

import { ApiConfig
       , CredentialsData
       , DialRequest
       , Error as Error_
       , Image as Image_
       , Receiver as Receiver
       , ReceiverDisplayStatus
       , SenderApplication
       , SessionRequest
       , Timeout
       , Volume } from "./dataClasses";

import { AutoJoinPolicy
       , Capability
       , DefaultActionPolicy
       , DialAppState
       , ErrorCode
       , ReceiverAction
       , ReceiverAvailability
       , ReceiverType
       , SenderPlatform
       , SessionStatus
       , VolumeControlType } from "./enums";
import messaging from "../../messaging";


export * as media from "./media";

export {
    // Enums
    AutoJoinPolicy, Capability, DefaultActionPolicy, DialAppState, ErrorCode
  , ReceiverAction, ReceiverAvailability, ReceiverType, SenderPlatform
  , SessionStatus, VolumeControlType

    // Classes
  , ApiConfig, CredentialsData, DialRequest, ReceiverDisplayStatus
  , SenderApplication, Session, SessionRequest, Timeout, Volume

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

const receiverList: Array<{ id: string }> = [];
const sessionList: Session[] = [];

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

    apiConfig.receiverListener(receiverList.length
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
        if (errorCallback) {
            errorCallback(new Error_(ErrorCode.API_NOT_INITIALIZED));
        }

        return;
    }

    // Already requesting session
    if (sessionRequestInProgress) {
        if (errorCallback) {
            errorCallback(new Error_(ErrorCode.INVALID_PARAMETER
                  , "Session request already in progress."));
        }

        return;
    }

    // No available receivers
    if (!receiverList.length) {
        if (errorCallback) {
            errorCallback(new Error_(ErrorCode.RECEIVER_UNAVAILABLE));
        }

        return;
    }

    sessionRequestInProgress = true;

    sessionSuccessCallback = successCallback;
    sessionErrorCallback = errorCallback;

    // Open destination chooser
    sendMessageResponse({
        subject: "main:selectReceiver"
    });
}

export function _requestSession(
        receiver: ReceiverDevice
      , successCallback?: RequestSessionSuccessCallback
      , errorCallback?: ErrorCallback): void {

    logger.info("cast._requestSession");

    if (!apiConfig) {
        if (errorCallback) {
            errorCallback(new Error_(ErrorCode.API_NOT_INITIALIZED));
        }

        return;
    }

    if (sessionRequestInProgress) {
        if (errorCallback) {
            errorCallback(new Error_(ErrorCode.INVALID_PARAMETER
                  , "Session request already in progress."));
        }

        return;
    }

    if (!receiverList.length) {
        if (errorCallback) {
            errorCallback(new Error_(ErrorCode.RECEIVER_UNAVAILABLE));
        }

        return;
    }

    sessionRequestInProgress = true;

    createSession(receiver).then(session => {
        sessionRequestInProgress = false;
        if (successCallback) {
            successCallback(session);
        }
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


function createSession(receiver: ReceiverDevice): Promise<Session> {
    const selectedReceiver = new Receiver(
        receiver.id
      , receiver.friendlyName);

    (selectedReceiver as any)._address = receiver.host;
    (selectedReceiver as any)._port = receiver.port;

    async function createSessionObject(): Promise<Session> {
        return new Promise((resolve, _reject) => {
            const session = new Session(
                    sessionList.length.toString()   // sessionId
                  , apiConfig.sessionRequest.appId  // appId
                  , receiver.friendlyName           // displayName
                  , []                              // appImages
                  , selectedReceiver                // receiver
                  , session => {
                        sendMessageResponse({
                            subject: "main:sessionCreated"
                        });

                        resolve(session);
                    });
        });
    }

    // If an existing session is active, stop it and start new one
    // TODO: Fix whatever broken behaviour this is
    if (sessionList.length) {
        const lastSession = sessionList[sessionList.length - 1];

        if (lastSession.status !== SessionStatus.STOPPED) {
            return new Promise((resolve, _reject) => {
                lastSession.stop(() => {
                    resolve(createSessionObject());
                });
            });
        }
    }

    return createSessionObject();
}


onMessage(async message => {
    switch (message.subject) {
        case "shim:initialized": {
            isAvailable = true;
            break;
        }

        /**
         * Cast destination found (serviceUp). Set the API availability
         * property and call the page event function (__onGCastApiAvailable).
         */
        case "shim:serviceUp": {
            const receiver = message.data;

            if (receiverList.find(r => r.id === receiver.id)) {
                break;
            }

            receiverList.push(receiver);

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
            const receiverIndex = receiverList.findIndex(
                    receiver => receiver.id === message.data.id);

            receiverList.splice(receiverIndex, 1);

            if (receiverList.length === 0) {
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

            const { receiver } = message.data;

            for (const listener of receiverActionListeners) {
                logger.info("Calling receiver action listener", receiver);

                const castReceiver = new Receiver(
                        receiver.id, receiver.friendlyName);
                listener(castReceiver, ReceiverAction.CAST);
            }

            const session = await createSession(receiver);
            sessionRequestInProgress = false;
            if (sessionSuccessCallback) {
                sessionSuccessCallback(session);
            }

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

        case "shim:launchApp": {
            const receiver: ReceiverDevice = message.data.receiver;
            _requestSession(receiver
                  , session => {
                        apiConfig.sessionListener(session);
                    });

            break;
        }
    }
});
