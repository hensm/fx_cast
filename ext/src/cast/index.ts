"use strict";

import * as cast from "./api";
import logger from "../lib/logger";

import { CAST_FRAMEWORK_SCRIPT_URL } from "../lib/endpoints";
import { loadScript } from "../lib/utils";
import { onMessage } from "./eventMessageChannel";

const _window = window as any;

if (!_window.chrome) {
    _window.chrome = {};
}

// Create page-accessible API object
_window.chrome.cast = cast;

let bridgeInfo: any;
let frameworkScriptPromise: Promise<HTMLScriptElement>;

/**
 * If loaded within a page via a <script> element,
 * document.currentScript should exist and we can check its
 * [src] query string for the loadCastFramework param.
 */
if (document.currentScript) {
    const currentScript = document.currentScript as HTMLScriptElement;
    const currentScriptUrl = new URL(currentScript.src);
    const currentScriptParams = new URLSearchParams(currentScriptUrl.search);

    // Load Framework API if requested
    if (currentScriptParams.get("loadCastFramework") === "1") {
        if (!_window.cast) {
            _window.cast = {};
        }

        // Queue up the framework script load to speed up init
         frameworkScriptPromise = loadScript(CAST_FRAMEWORK_SCRIPT_URL);
         frameworkScriptPromise.catch(() => {
             logger.error("Failed to load CAF script!");
         });
    }
}

onMessage(async message => {
    switch (message.subject) {
        case "cast:initialized": {
            bridgeInfo = message.data;

            // If framework API is requested, ensure loaded
            if (frameworkScriptPromise) {
                await frameworkScriptPromise;
            }
            
            // Call page script/framework API script's init function
            const initFn = _window.__onGCastApiAvailable;
            if (initFn && typeof initFn === "function") {
                initFn(bridgeInfo && bridgeInfo.isVersionCompatible);
            }

            break;
        }
    }
});
