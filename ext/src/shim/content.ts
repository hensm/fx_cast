"use strict";

import { Message } from "../types";
import { onMessageResponse, sendMessage } from "./messageBridge";

// Message ports
const backgroundPort = browser.runtime.connect({ name: "shim" });
let popupPort: browser.runtime.Port;


// Set popupPort once it connects
browser.runtime.onConnect.addListener(port => {
    if (port.name === "popup") {
        popupPort = port;
    }

    port.onMessage.addListener(sendMessage);
});

// Forward background messages to shim
backgroundPort.onMessage.addListener(sendMessage);

// Forward shim messages to popup and background script
onMessageResponse((message: Message) => {
    const [ destination ] = message.subject.split(":/");

    if (destination === "popup") {
        if (popupPort) {
            popupPort.postMessage(message);
        }
    } else {
        backgroundPort.postMessage(message);
    }
});
