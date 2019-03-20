"use strict";

import * as cast from "./cast";

import { onMessage } from "./messageBridge";


const _window = (window as any);

if (!_window.chrome) {
    _window.chrome = {};
}

_window.chrome.cast = cast;

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

        import("./framework").then(framework => {
            _window.cast.framework = framework.default;
        });
    }
}


onMessage(message => {
    switch (message.subject) {
        case "shim:/initialized": {
            const bridgeInfo = message.data;

            // Call page's API loaded function if defined
            const readyFunction = _window.__onGCastApiAvailable;
            if (readyFunction && typeof readyFunction === "function") {
                readyFunction(bridgeInfo && bridgeInfo.isVersionCompatible);
            }

            break;
        }
    }
});
