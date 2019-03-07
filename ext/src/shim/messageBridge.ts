"use strict";

import { Message } from "../types";

type ListenerFunc = (message: Message) => void;


export function onMessage (listener: ListenerFunc) {
    document.addEventListener("__castMessage", (ev: CustomEvent) => {
        listener(JSON.parse(ev.detail));

        /**
         * TODO:
         * Figure out a way to handle and stop propagation of this
         * event to hide it from page scripts.
         * Currently the event handler is set after the page loads the
         * cast API, allowing pages set handlers before this script,
         * intercept the event, and cancel it.
         */
        ev.stopPropagation();
    }, true);
}

export function sendMessageResponse (message: Message) {
    const event = new CustomEvent("__castMessageResponse", {
        detail: JSON.stringify(message)
    });

    document.dispatchEvent(event);
}


export function onMessageResponse (listener: ListenerFunc) {
    document.addEventListener("__castMessageResponse", (ev: CustomEvent) => {
        listener(JSON.parse(ev.detail));
    }, true);
}

export function sendMessage (message: Message) {
    const event = new CustomEvent("__castMessage", {
        detail: JSON.stringify(message)
    });

    document.dispatchEvent(event);
}
