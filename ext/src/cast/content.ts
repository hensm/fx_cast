/**
 * Cast Sender SDK page script loaded in place of remote cast_sender
 * script. Handles API object creation and initializes sender apps.
 */

import logger from "../lib/logger";
import { loadScript } from "../lib/utils";

import pageMessenging from "./pageMessenging";
import CastSDK from "./sdk";
import { CAST_FRAMEWORK_SCRIPT_URL } from "./urls";

// Create page-accessible API object
window.chrome.cast = new CastSDK();

let frameworkScriptPromise: Promise<HTMLScriptElement> | undefined;

// Load remote CAF script if requested in script URL params.
if (document.currentScript) {
    const currentScript = document.currentScript as HTMLScriptElement;
    const currentScriptParams = new URLSearchParams(
        new URL(currentScript.src).search
    );

    if (currentScriptParams.get("loadCastFramework") === "1") {
        frameworkScriptPromise = loadScript(CAST_FRAMEWORK_SCRIPT_URL);
        frameworkScriptPromise.catch(() => {
            logger.error("Failed to load CAF script!");
        });
    }
}

pageMessenging.page.addListener(async message => {
    switch (message.subject) {
        case "cast:initialized": {
            // If framework API is loading, wait until completed
            await frameworkScriptPromise;

            // Call page script/framework API script's init function
            const initFn = window.__onGCastApiAvailable;
            if (initFn && typeof initFn === "function") {
                initFn(message.data.isAvailable);
            }

            break;
        }
    }
});
