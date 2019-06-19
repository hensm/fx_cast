"use strict";

import { onMessageResponse, sendMessage } from "./eventMessageChannel";


// Message port to background script
const backgroundPort = browser.runtime.connect({ name: "shim" });

// Forward background messages to shim
backgroundPort.onMessage.addListener(sendMessage);

// Forward shim messages to background
onMessageResponse(message => {
    backgroundPort.postMessage(message);
});
