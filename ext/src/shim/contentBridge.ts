"use strict";

import { loadScript } from "../lib/utils";
import { Message } from "../types";
import { onMessageResponse, sendMessage } from "./eventMessageChannel";


const { isFramework }
    : { isFramework: boolean } = (window as any);

/**
 * Framework API library requires webcomponents for the cast
 * button custom element (<google-cast-launcher>).
 */
if (isFramework) {
    loadScript(browser.runtime.getURL("vendor/webcomponents-lite.js"));
}


// Message port to background script
const backgroundPort = browser.runtime.connect({ name: "shim" });

const forwardToShim = (message: Message) => sendMessage(message);
const forwardToMain = (message: Message) => backgroundPort.postMessage(message);

// Add message listeners
backgroundPort.onMessage.addListener(forwardToShim);
const listener = onMessageResponse(forwardToMain);

// Remove listeners if main disconnects
backgroundPort.onDisconnect.addListener(() => {
    backgroundPort.onMessage.removeListener(forwardToShim);
    listener.disconnect();
});
