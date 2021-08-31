"use strict";

const _ = browser.i18n.getMessage;

/**
 * Make synchronous request for another script to keep other page
 * scripts from loading before its execution.
 */
const req = new XMLHttpRequest();
req.open(
    "GET",
    browser.runtime.getURL("senders/media/overlay/overlayContent.js"),
    false
);

req.send();

if (req.status === 200) {
    // TODO: Replace with cast icons until AirPlay support is ready
    const iconAirPlayAudio = browser.runtime.getURL(
        "senders/media/overlay/AirPlay_Audio.svg"
    );
    const iconAirPlayVideo = browser.runtime.getURL(
        "senders/media/overlay/AirPlay_Audio.svg"
    );

    const scriptElement = document.createElement("script");
    scriptElement.textContent = `(function(){
        const iconAirPlayAudio = "${iconAirPlayAudio}";
        const iconAirPlayVideo = "${iconAirPlayVideo}";
        const mediaOverlayTitle = "${_("mediaOverlayTitle", "X")}";
        ${req.responseText}
    })();`;

    // <head> probably doesn't exist yet
    (document.head || document.documentElement).append(scriptElement);
}
