"use strict";

import { Message } from "../types";
import { onMessageResponse, sendMessage } from "./messageBridge";


if ((window as any)._isFramework) {
    const polyfillScriptElement = document.createElement("script");
    polyfillScriptElement.src = browser.runtime.getURL(
            "vendor/webcomponents-lite.js")
    document.head.append(polyfillScriptElement);
}


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
