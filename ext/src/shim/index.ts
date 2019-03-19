"use strict";

import cast from "./cast";

import { onMessage } from "./messageBridge";


const global = (window as any);

if (!global.chrome) {
    global.chrome = {};
}

global.chrome.cast = cast;


onMessage(message => {
    switch (message.subject) {
        case "shim:/initialized": {
            const bridgeInfo = message.data;

            cast.isAvailable = true;

            // Call page's API loaded function if defined
            const readyFunction = global.__onGCastApiAvailable;
            if (readyFunction && typeof readyFunction === "function") {
                readyFunction(bridgeInfo && bridgeInfo.isVersionCompatible);
            }

            break;
        }
    }
});
