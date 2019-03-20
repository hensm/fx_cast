"use strict";

import * as cast from "./cast";

import { onMessage } from "./messageBridge";


const _window = (window as any);

if (!_window.chrome) {
    _window.chrome = {};
}

_window.chrome.cast = cast;


const CAST_FRAMEWORK_SCRIPT_URL =
        "https://www.gstatic.com/cast/sdk/libs/sender/1.0/cast_framework.js";

let bridgeInfo: any;
let scriptLoaded = false;

// Call page's API loaded function if defined
function callPageReadyFunction () {
    const readyFunction = _window.__onGCastApiAvailable;
    if (readyFunction && typeof readyFunction === "function") {
        readyFunction(bridgeInfo && bridgeInfo.isVersionCompatible);
    }
}


/**
 * If loaded within a page via a <script> element,
 * document.currentScript should exist and we can check its
 * [src] query string for the loadCastFramework param.
 */
if (document.currentScript) {
    const currentScript = (document.currentScript as HTMLScriptElement);
    const currentScriptUrl = new URL(currentScript.src);
    const currentScriptParams = new URLSearchParams(currentScriptUrl.search);

    // Load Framework API if requested
    if (currentScriptParams.get("loadCastFramework") === "1") {
        if (!_window.cast) {
            _window.cast = {};
        }

        const scriptElement = document.createElement("script");
        scriptElement.src = CAST_FRAMEWORK_SCRIPT_URL;
        (document.head || document.documentElement).append(scriptElement);

        scriptElement.addEventListener("load", ev => {
            if (bridgeInfo) {
                callPageReadyFunction();
            }

            scriptLoaded = true;
        });

        /*
        // TODO: Finish cast.framework and replace Google's implementation
        import("./framework").then(framework => {
            _window.cast.framework = framework.default;
        });
        */
    }
}


onMessage(message => {
    switch (message.subject) {
        case "shim:/initialized": {
            bridgeInfo = message.data;

            if (!scriptLoaded) {
                callPageReadyFunction();
            }

            break;
        }
    }
});
