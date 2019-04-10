"use strict";

import { Message } from "../types";


interface Details {
    tabId: number
  , frameId: number
}

type SenderCallback = (message: Message, details: Details) => void;


const routeMap = new Map<string, SenderCallback>();

function register (routeName: string, senderCallback: SenderCallback) {
    routeMap.set(routeName, senderCallback);
}

function deregister (routeName: string) {
    routeMap.delete(routeName);
}

function handleMessage (message: Message, details?: Details) {
    const destination = message.subject.split(":")[0];
    if (routeMap.has(destination)) {
        routeMap.get(destination)(message, details);
    }
}

export default {
    register
  , deregister
  , handleMessage
};
