"use strict";

import Cast from "./cast";
import media from "./media";

import { Message } from "../types";
import { onMessage, sendMessageResponse } from "./messageBridge";


function forwardAs (subject: string) {
    return function (ev: CustomEvent) {
        const message: Message = {
              subject
            , _id: ev.detail.id        
        };

        if (ev.detail.data) {
            message.data = ev.detail.data;
        }

        sendMessageResponse(message);
    }
}


const cast = new Cast();
let sessionWrapper: ReturnType<typeof cast.getSessionWrapper>;

cast.addEventListener("initialized", forwardAs("bridge:/startDiscovery"));
cast.addEventListener("sessionRequested", forwardAs("main:/openPopup"));
cast.addEventListener("sessionCreated", forwardAs("popip:/close"));

cast.addEventListener("sessionWrapperCreated", () => {
    sessionWrapper = cast.getSessionWrapper();

    sessionWrapper.addEventListener("initialized"
          , forwardAs("bridge:/session/initialize"));

    sessionWrapper.addEventListener("impl_addMessageListener"
          , forwardAs("bridge:/session/impl_addMessageListener"));
    sessionWrapper.addEventListener("impl_leave"
          , forwardAs("bridge:/session/impl_leave"));
    sessionWrapper.addEventListener("impl_sendMessage"
          , forwardAs("bridge:/session/impl_sendMessage"));
    sessionWrapper.addEventListener("impl_setReceiverMuted"
          , forwardAs("bridge:/session/impl_setReceiverMuted"));
    sessionWrapper.addEventListener("impl_setReceiverVolumeLevel"
          , forwardAs("bridge:/session/impl_setReceiverVolumeLevel"));
    sessionWrapper.addEventListener("impl_stop"
          , forwardAs("bridge:/session/impl_stop"));
});



const global = (window as any);

if (!global.chrome) {
    global.chrome = {};
}

global.chrome.cast = cast.getInterface();
global.chrome.cast.media = media;


onMessage(message => {
    switch (message.subject) {
        /**
         * Cast destination found.
         */
        case "shim:/serviceUp": {
            const receiver = message.data;
            const receiverList = cast.getReceiverList();

            if (receiverList.find(r => r.id === receiver.id)) {
                break;
            }

            cast.addReciever(receiver);

            break;
        }

        /**
         * Cast destination lost.
         */
        case "shim:/serviceDown": {
            const receiver = message.data;
            cast.removeReceiver(receiver.id);

            break;
        }

        case "shim:/selectReceiver": {
            console.info("fx_cast (Debug): Selected receiver");

            cast.createSession(
                    message.data.receiver
                  , message.data.selectedMedia);

            break;
        }

        /**
         * Popup is ready to receive data to populate the cast destination
         * chooser.
         */
        case "shim:/popupReady": {
            sendMessageResponse({
                subject: "popup:/populateReceiverList"
              , data: {
                    receivers: cast.getReceiverList()
                  , selectedMedia: cast.getSelectedMedia()
                }
            });

            break;
        }

        /**
         * Popup closed before session established.
         */
        case "shim:/popupClosed": {
            cast.cancelSessionRequest();
            break;
        }


        case "shim:/initialized": {
            const bridgeInfo = message.data;

            // Call page's API loaded function if defined
            const readyFunction = global.__onGCastApiAvailable;
            if (readyFunction && typeof readyFunction === "function") {
                readyFunction(bridgeInfo && bridgeInfo.isVersionCompatible);
            }

            break;
        }



        case "shim:/session/connected": {
            sessionWrapper.setConnected(
                    message.data.sessionId
                  , message.data.namespaces
                  , message.data.displayName
                  , message.data.statusText);

            break;
        }

        case "shim:/session/stopped": {
            sessionWrapper.setStopped();
            break;
        }

        case "shim:/session/updateStatus": {
            sessionWrapper.updateStatus(message.data);
            break;
        }


        case "shim:/session/impl_addMessageListener": {
            const { namespace, data } = message.data;
            sessionWrapper.impl_addMessageListener(namespace, data);
            break;
        }
        case "shim:/session/impl_sendMessage": {
            const { messageId, error } = message.data;
            sessionWrapper.impl_sendMessage(messageId, error);
            break;
        }
        case "shim:/session/impl_setReceiverMuted": {
            const { volumeId, error } = message.data;
            sessionWrapper.impl_setReceiverMuted(volumeId, error);
            break;
        }
        case "shim:/session/impl_setReceiverVolumeLevel": {
            const { volumeId, error } = message.data;
            sessionWrapper.impl_setReceiverVolumeLevel(volumeId, error);
            break;
        }
        case "shim:/session/impl_stop": {
            const { stopId, error } = message.data;
            sessionWrapper.impl_stop(stopId, error);
            break;
        }

    }
});
