"use strict";

let chrome;
let logMessage;

const FX_CAST_RECEIVER_APP_ID = "19A6F4AE";
const FX_CAST_NAMESPACE = "urn:x-cast:fx_cast";

let session;
let sessionRequested = false;

let pc;

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


function sendMessage (subject, data) {
    session.sendMessage(FX_CAST_NAMESPACE, {
        subject
      , data
    });
}

window.addEventListener("beforeunload", () => {
    sendMessage("close");
});

async function onRequestSessionSuccess (session_, selectedMedia) {
    logMessage("onRequestSessionSuccess");

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

    switch (selectedMedia) {
        case "tab":
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

        case "screen":
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { mediaSource: "window" }
            });
            pc.addStream(stream);
            break;
    }

    const desc = await pc.createOffer();
    await pc.setLocalDescription(desc);

    sendMessage("peerConnectionOffer", desc);
}
function onRequestSessionError () {
    logMessage("onRequestSessionError");
}

function sessionListener (session) {
    logMessage("sessionListener");
}
function receiverListener (availability) {
    logMessage("receiverListener");

    if (!sessionRequested && availability === chrome.cast.ReceiverAvailability.AVAILABLE) {
        sessionRequested = true;
        chrome.cast.requestSession(
                onRequestSessionSuccess
              , onRequestSessionError);
    }
}


function onInitializeSuccess () {
    logMessage("onInitializeSuccess");
}
function onInitializeError () {
    logMessage("onInitializeError");
}


window.__onGCastApiAvailable = (loaded, errorInfo) => {
    chrome = window.chrome;
    logMessage = chrome.cast.logMessage;

    logMessage("__onGCastApiAvailable success");

    const sessionRequest = new chrome.cast.SessionRequest(
            FX_CAST_RECEIVER_APP_ID);

    const apiConfig = new chrome.cast.ApiConfig(sessionRequest
          , sessionListener
          , receiverListener
          , undefined, undefined
          , selectedMedia);

    chrome.cast.initialize(apiConfig
          , onInitializeSuccess
          , onInitializeError);
}
