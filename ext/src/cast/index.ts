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
let isFramework = false;

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

        /**
         * Set isFramework flag to load framework once the base cast API is
         * initialized
         */
        isFramework = true;
    }
}

onMessage(async message => {
    switch (message.subject) {
        case "cast:initialized": {
            bridgeInfo = message.data;

            // If framework API is requested, load that first
            if (isFramework) {
                try {
                    await loadScript(CAST_FRAMEWORK_SCRIPT_URL);
                } catch (err) {
                    logger.error("Failed to load CAF script!");
                }
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
