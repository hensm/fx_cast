"use strict";

import ApiConfig             from "./classes/ApiConfig";
import DialRequest           from "./classes/DialRequest";
import Error_                from "./classes/Error";
import Image_                from "./classes/Image";
import Receiver              from "./classes/Receiver";
import ReceiverDisplayStatus from "./classes/ReceiverDisplayStatus";
import SenderApplication     from "./classes/SenderApplication";
import Session               from "./classes/Session";
import SessionRequest        from "./classes/SessionRequest";
import Timeout               from "./classes/Timeout";
import Volume                from "./classes/Volume";

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

import { requestSession as requestSessionTimeout } from "../timeout";

import state from "../state";

import { onMessage, sendMessage } from "../messageBridge";


const cast = {
    // Enums
    AutoJoinPolicy
  , Capability
  , DefaultActionPolicy
  , DialAppState
  , ErrorCode
  , ReceiverAction
  , ReceiverAvailability
  , ReceiverType
  , SenderPlatform
  , SessionStatus
  , VolumeControlType

    // Classes
  , ApiConfig
  , DialRequest
  , Error: Error_
  , Image: Image_
  , Receiver
  , ReceiverDisplayStatus
  , SenderApplication
  , Session
  , SessionRequest
  , Timeout
  , Volume

  , timeout: new Timeout()
  , isAvailable: true
  , VERSION: [ 1, 2 ]
};


const receiverListeners = new Set();

let sessionSuccessCallback;
let sessionErrorCallback;


cast.addReceiverActionListener = (listener) => {
    console.info("Caster (Debug): cast.addReceiverActionListener");
    receiverListeners.add(listener);
};

cast.initialize = (
        apiConfig
      , successCallback
      , errorCallback) => {

    console.info("Caster (Debug): cast.initialize");

    // Already initialized
    if (state.apiConfig) {
        errorCallback(new Error_(ErrorCode.RECEIVER_UNAVAILABLE));
        return;
    }

    state.apiConfig = apiConfig;

    sendMessage({
        subject: "bridge:discover"
    });

    apiConfig.receiverListener(state.receiverList.length
        ? ReceiverAvailability.AVAILABLE
        : ReceiverAvailability.UNAVAILABLE);

    successCallback();
};

cast.logMessage = (message) => {
    console.log("CAST MSG:", message);
};

cast.precache = (data) => {
    console.info("STUB :: cast.precache");
};

cast.removeReceiverActionListener = (listener) => {
    receiverListeners.delete(listener);
}

cast.requestSession = (
        successCallback
      , errorCallback
      , opt_sessionRequest = state.apiConfig.sessionRequest) => {

    console.info("Caster (Debug): cast.requestSession");

    // Called before initialization
    if (!state.apiConfig) {
        errorCallback(new Error_(ErrorCode.API_NOT_INITIALIZED));
        return;
    }

    // No available receivers
    if (!state.receiverList.length) {
        errorCallback(new Error_(ErrorCode.RECEIVER_UNAVAILABLE));
        return;
    }

    sessionSuccessCallback = successCallback;
    sessionErrorCallback = errorCallback;

    // Open destination chooser
    sendMessage({
        subject: "main:openPopup"
    });
};

cast.requestSessionById = (sessionId) => {
    console.info("STUB :: cast.requestSessionById");
};

cast.setCustomReceivers = (receivers, successCallback, errorCallback) => {
    console.info("STUB :: cast.setCustomReceivers");
};

cast.setPageContext = (win) => {
    console.info("STUB :: cast.setPageContext");
};

cast.setReceiverDisplayStatus = (sessionId) => {
    console.info("STUB :: cast.setReceiverDisplayStatus");
};

cast.unescape = (escaped) => unescape(escaped);


onMessage(message => {
    switch (message.subject) {
        /**
         * Cast destination found (serviceUp). Set the API availability
         * property and call the page event function (__onGCastApiAvailable).
         */
        case "shim:serviceUp": {
            const receiver = new Receiver(
                    message.data.id
                  , message.data.friendlyName);

            receiver._address = message.data.address;
            receiver._port = message.data.port;

            if (state.receiverList.find(r => r.label === receiver.label)) {
                break;
            }

            state.receiverList.push(receiver);

            // Notify listeners of new cast destination
            state.apiConfig.receiverListener(ReceiverAvailability.AVAILABLE);

            break;
        };

        /**
         * Cast destination lost (serviceDown). Remove from the receiver list
         * and update availability state.
         */
        case "shim:serviceDown": {
            state.receiverList = state.receiverList.filter(
                    receiver => receiver.label !== message.data.id);

            if (state.receiverList.length === 0) {
                state.apiConfig.receiverListener(
                        ReceiverAvailability.UNAVAILABLE);
            }

            break;
        };

        case "shim:selectReceiver": {
            console.info("Caster (Debug): Selected receiver");
            const selectedReceiver = message.data.receiver;

            const sessionConstructorArgs = [
                state.sessionList.length             // sessionId
              , state.apiConfig.sessionRequest.appId // appId
              , selectedReceiver.friendlyName        // displayName
              , []                                   // appImages
              , selectedReceiver                     // receiver
              , (session) => {
                    sendMessage({
                        subject: "popup:close"
                    });

                    state.apiConfig.sessionListener(session);
                    sessionSuccessCallback(session, message.data.selectedMedia);
                }
            ];

            // If existing session active, stop it and start new one
            if (state.sessionList.length) {
                const lastSession
                        = state.sessionList[state.sessionList.length - 1];

                if (lastSession.status !== SessionStatus.STOPPED) {
                    lastSession.stop(() => {
                        state.sessionList.push(new Session(
                                ...sessionConstructorArgs));
                    });
                    break;
                }
            }

            state.sessionList.push(new Session(...sessionConstructorArgs));

            break;
        };

        /**
         * Popup is ready to receive data to populate the cast destination
         * chooser.
         */
        case "shim:popupReady": {
            sendMessage({
                subject: "popup:populate"
              , data: {
                    receivers: state.receiverList
                  , selectedMedia: state.apiConfig._selectedMedia
                }
            });

            break;
        };
    }
});

export default cast;
