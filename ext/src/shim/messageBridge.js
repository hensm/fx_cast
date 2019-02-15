"use strict";

export function onMessage (listener) {
    document.addEventListener("__castMessage", ev => {
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

export function sendMessageResponse (message) {
    const event = new CustomEvent("__castMessageResponse", {
        detail: JSON.stringify(message)
    });

    document.dispatchEvent(event);
}


export function onMessageResponse (listener) {
    document.addEventListener("__castMessageResponse", ev => {
        listener(JSON.parse(ev.detail));
    }, true);
}

export function sendMessage (message) {
    const event = new CustomEvent("__castMessage", {
        detail: JSON.stringify(message)
    });

    document.dispatchEvent(event);
}
