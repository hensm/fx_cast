"use strict";

import options from "../lib/options";
import cast, { init } from "../shim/export";

import { ReceiverSelectorMediaType }
        from "../receiver_selectors/ReceiverSelector";


// Variables passed from background
const { selectedMedia }
    : { selectedMedia: ReceiverSelectorMediaType } = (window as any);


const FX_CAST_NAMESPACE = "urn:x-cast:fx_cast";

let session: cast.Session;
let sessionRequested = false;

let pc: RTCPeerConnection;


const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

function size_canvas (
        width = window.innerWidth
      , height = window.innerHeight) {

    canvas.width = width;
    canvas.height = height;
}

 // Set initial size
size_canvas();

// Resize canvas whenever the window resizes
window.addEventListener("resize", () => {
    size_canvas();
});

let interval;


function sendMessage (subject: string, data: any) {
    session.sendMessage(FX_CAST_NAMESPACE, {
        subject
      , data
    }, null, null);
}

window.addEventListener("beforeunload", () => {
    sendMessage("close", null);
});


async function onRequestSessionSuccess (
        // tslint:disable-next-line:variable-name
        session_: cast.Session
      , newSelectedMedia: ReceiverSelectorMediaType) {

    cast.logMessage("onRequestSessionSuccess");

    session = session_;

    session.addMessageListener(FX_CAST_NAMESPACE
          , async (namespace, message) => {

        const { subject, data } = JSON.parse(message);

        switch (subject) {
            case "peerConnectionAnswer":
                pc.setRemoteDescription(data);
                break;

            case "iceCandidate":
                pc.addIceCandidate(data);
                break;
        }
    });

    pc = new RTCPeerConnection();
    pc.addEventListener("icecandidate", (ev) => {
        sendMessage("iceCandidate", ev.candidate);
    });

    switch (newSelectedMedia) {
        case ReceiverSelectorMediaType.Tab: {
            interval = setInterval(() => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawWindow(
                        window                     // window
                      , 0                          // x
                      , 0                          // y
                      , window.innerWidth          // w
                      , window.innerHeight         // h
                      , "white"                    // bgColor
                      , ctx.DRAWWINDOW_DRAW_VIEW); // flags
            }, 1000 / 30);

            pc.addStream(canvas.captureStream());

            break;
        }

        case ReceiverSelectorMediaType.Screen: {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { mediaSource: "screen" }
            });

            pc.addStream(stream);

            break;
        }
    }

    const desc = await pc.createOffer();
    await pc.setLocalDescription(desc);

    sendMessage("peerConnectionOffer", desc);
}

function onRequestSessionError () {
    cast.logMessage("onRequestSessionError");
}


function sessionListener (newSession: cast.Session) {
    cast.logMessage("sessionListener");
}
function receiverListener (availability: string) {
    cast.logMessage("receiverListener");

    if (!sessionRequested
            && availability === cast.ReceiverAvailability.AVAILABLE) {
        sessionRequested = true;
        cast.requestSession(
                onRequestSessionSuccess
              , onRequestSessionError);
    }
}


function onInitializeSuccess () {
    cast.logMessage("onInitializeSuccess");
}
function onInitializeError () {
    cast.logMessage("onInitializeError");
}


init().then(async bridgeInfo => {
    if (!bridgeInfo.isVersionCompatible) {
        console.error("__onGCastApiAvailable error");
        return;
    }


    const mirroringAppId = await options.get("mirroringAppId");
    const sessionRequest = new cast.SessionRequest(mirroringAppId);

    const apiConfig = new cast.ApiConfig(
            sessionRequest
          , sessionListener
          , receiverListener
          , undefined, undefined
          , selectedMedia);

    cast.initialize(apiConfig
          , onInitializeSuccess
          , onInitializeError);
});
