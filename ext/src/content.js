"use strict";

const backgroundPort = browser.runtime.connect({
    name: "shim"
});

backgroundPort.onMessage.addListener(message => {
    const event = new CustomEvent("__castMessage", {
        detail: JSON.stringify(message)
    });
    document.dispatchEvent(event);
});

let popupPort;
browser.runtime.onConnect.addListener(port => {
    if (port.name === "popup") {
        popupPort = port;
    }

    port.onMessage.addListener(message => {
        const event = new CustomEvent("__castMessage", {
            detail: JSON.stringify(message)
        });
        document.dispatchEvent(event);
    })
});

document.addEventListener("__castMessageResponse", ev => {
    if (ev.detail.destination === "popup") {
        if (popupPort) {
            popupPort.postMessage(ev.detail);
        }
        return;
    }

    backgroundPort.postMessage(ev.detail);
});
