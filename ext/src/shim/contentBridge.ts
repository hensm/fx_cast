"use strict";

import { onMessageResponse, sendMessage } from "./eventMessageChannel";
import { loadScript } from "../lib/utils";


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

// Forward background messages to shim
backgroundPort.onMessage.addListener(sendMessage);

// Forward shim messages to background
onMessageResponse(message => {
    backgroundPort.postMessage(message);
});
