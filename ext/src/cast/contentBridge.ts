"use strict";

import { onMessageResponse, sendMessage } from "./eventMessageChannel";

import messaging, { Message } from "../messaging";

// Message port to background script
export const backgroundPort = messaging.connect({ name: "cast" });

const forwardToCast = (message: Message) => sendMessage(message);
const forwardToMain = (message: Message) => backgroundPort.postMessage(message);

// Add message listeners
backgroundPort.onMessage.addListener(forwardToCast);
const listener = onMessageResponse(forwardToMain);

// Remove listeners
backgroundPort.onDisconnect.addListener(() => {
    backgroundPort.onMessage.removeListener(forwardToCast);
    listener.disconnect();
});
