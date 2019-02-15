"use strict";

import { onMessageResponse, sendMessage } from "./messageBridge";


const backgroundPort = browser.runtime.connect({
    name: "shim"
});
backgroundPort.onMessage.addListener(sendMessage);

let popupPort;
browser.runtime.onConnect.addListener(port => {
    if (port.name === "popup") {
        popupPort = port;
    }
    port.onMessage.addListener(sendMessage)
});

onMessageResponse(message => {
    const [ destination ] = message.subject.split(":/");
    switch (destination) {
        case "popup": {
            if (popupPort) {
                popupPort.postMessage(message);
            }

            break;
        };

        default: {
            backgroundPort.postMessage(message);
        }
    }
});
