"use strict";

type SenderCallback = (message: any, details: any) => void;

const routeMap = new Map<string, SenderCallback>();

function register (routeName: string, senderCallback: SenderCallback) {
    routeMap.set(routeName, senderCallback);
}

function deregister (routeName: string) {
    routeMap.delete(routeName);
}

function handleMessage (message: any, details?: any) {
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
