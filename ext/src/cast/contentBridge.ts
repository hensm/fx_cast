"use strict";

import messaging, { Message } from "../messaging";
import { PageEventMessenger, ExtensionEventMessenger } from "./eventMessaging";

// Create messengers manually instead of relying on getters
const eventMessaging = {
    page: new PageEventMessenger(),
    extension: new ExtensionEventMessenger()
};

// Message port to background script
export const backgroundPort = messaging.connect({ name: "cast" });

const forwardToPage = (message: Message) => {
    eventMessaging.extension.sendMessage(message);
};
const forwardToMain = (message: Message) => {
    backgroundPort.postMessage(message);
};

// Add message listeners
backgroundPort.onMessage.addListener(forwardToPage);
eventMessaging.extension.addListener(forwardToMain);

// Remove listeners
backgroundPort.onDisconnect.addListener(() => {
    backgroundPort.onMessage.removeListener(forwardToPage);
    eventMessaging.extension.addListener(forwardToMain);
});
