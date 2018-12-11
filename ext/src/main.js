"use strict";

import defaultOptions from "./options/defaultOptions";
import messageRouter  from "./messageRouter";

import semver from "semver";


const _ = browser.i18n.getMessage;


browser.runtime.onInstalled.addListener(async details => {
    switch (details.reason) {

        // Set default options
        case "install": {
            await browser.storage.sync.set({
                options: defaultOptions
            });
            break;
        };

        // Set newly added options
        case "update": {
            const { options: existingOptions }
                    = await browser.storage.sync.get("options");

            const newOptions = {};

            // Find options not already in storage
            for (const [ key, val ] of Object.entries(defaultOptions)) {
                if (!existingOptions.hasOwnProperty(key)) {
                    newOptions[key] = val;
                }
            }

            // Update storage with default values of new options
            await browser.storage.sync.set({
                options: {
                    ...existingOptions
                  , ...newOptions
                }
            });

            break;
        };
    }

    // Call after default options have been set
    createMenus();
});


// Menu IDs
let mirrorCastMenuId;
let mediaCastMenuId;

const mediaCastTargetUrlPatterns = new Set([
    "http://*/*"
  , "https://*/*"
]);

const LOCAL_MEDIA_URL_PATTERN = "file://*/*";

async function createMenus () {
    const { options } = await browser.storage.sync.get("options");

    /**
     * If options aren't set or menus have already been
     * created, return.
     */
    if (!options || mirrorCastMenuId || mediaCastMenuId) return;

    if (options.localMediaEnabled) {
        mediaCastTargetUrlPatterns.add(LOCAL_MEDIA_URL_PATTERN);
    }

    // <video>/<audio> "Cast..." context menu item
    mediaCastMenuId = await browser.menus.create({
        contexts: [ "audio", "video" ]
      , id: "contextCastMedia"
      , targetUrlPatterns: Array.from(mediaCastTargetUrlPatterns)
      , title: _("contextCast")
      , visible: options.mediaEnabled
    });

    // Screen/Tab mirroring "Cast..." context menu item
    mirrorCastMenuId = await browser.menus.create({
        contexts: [ "browser_action", "page" ]
      , id: "contextCast"
      , title: _("contextCast")
      , visible: options.mirroringEnabled
    });
}


// Google-hosted API loader script
const SENDER_SCRIPT_URL =
        "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js";

const SENDER_SCRIPT_FRAMEWORK_URL =
        `${SENDER_SCRIPT_URL}?loadCastFramework=1`;

/**
 * Sender applications load a cast_sender.js script that
 * functions as a loader for the internal chrome-extension:
 * hosted script.
 *
 * We can redirect this and inject our own script to setup
 * the API shim.
 */
browser.webRequest.onBeforeRequest.addListener(
        async details => {
            switch (details.url) {
                case SENDER_SCRIPT_URL:
                    // Content/Page script bridge
                    await browser.tabs.executeScript(details.tabId, {
                        file: "content.js"
                      , frameId: details.frameId
                      , runAt: "document_start"
                    });

                    return {
                        redirectUrl: browser.runtime.getURL("shim/bundle.js")
                    };

                case SENDER_SCRIPT_FRAMEWORK_URL:
                    // TODO: implement cast.framework

                    return {
                        cancel: true
                    };
            }
        }
      , { urls: [
            SENDER_SCRIPT_URL
          , SENDER_SCRIPT_FRAMEWORK_URL
        ]}
      , [ "blocking" ]);


/**
 * Returns a Chrome user agent string with the provided platform.
 */
function getChromeUA (platform) {
    return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.67 Safari/537.36`;
}

// Desktop platform Chrome UA strings
const UA_STRINGS = {
    "mac"   : getChromeUA("Macintosh; Intel Mac OS X 10_14_1")
  , "win"   : getChromeUA("Windows NT 10.0; Win64; x64")
  , "linux" : getChromeUA("Mozilla/5.0 (X11; Linux x86_64")
};

// Current user agent string for all whitelisted requests
let currentUAString;

/**
 * Web apps usually only load the sender library and
 * provide cast functionality if the browser is detected
 * as Chrome, so we should rewrite the User-Agent header
 * to reflect this on whitelisted sites.
 */
async function onBeforeSendHeaders (details) {
    const { options } = await browser.storage.sync.get("options");

    // Create Chrome UA from platform info on first run
    if (!currentUAString) {
        currentUAString = UA_STRINGS[
                (await browser.runtime.getPlatformInfo()).os]
    }

    // Find and rewrite the User-Agent header
    for (const header of details.requestHeaders) {
        if (header.name.toLowerCase() === "user-agent") {
            header.value = currentUAString;
            break;
        }
    }

    return {
        requestHeaders: details.requestHeaders
    };
}

async function onOptionsUpdated (alteredOptions) {
    const { options } = await browser.storage.sync.get("options");

    // If options aren't set yet, return
    if (!options) return;

    const registerFunctions = {
        onBeforeSendHeaders () {
            browser.webRequest.onBeforeSendHeaders.addListener(
                    onBeforeSendHeaders
                  , { urls: options.userAgentWhitelistEnabled
                        ? options.userAgentWhitelist
                        : [] }
                  , [  "blocking", "requestHeaders" ]);
        }
    };

    if (!alteredOptions) {
        // If no altered properties specified, register all listeners
        for (const func of Object.values(registerFunctions)) {
            func();
        }
    } else {
        if (alteredOptions.includes("userAgentWhitelist")
                || alteredOptions.includes("userAgentWhitelistEnabled")) {
            browser.webRequest.onBeforeSendHeaders.removeListener(onBeforeSendHeaders);
            registerFunctions.onBeforeSendHeaders();
        }

        if (alteredOptions.includes("mirroringEnabled")) {
            browser.menus.update(mirrorCastMenuId, {
                visible: options.mirroringEnabled
            });
        }

        if (alteredOptions.includes("mediaEnabled")) {
            browser.menus.update(mediaCastMenuId, {
                visible: options.mediaEnabled
            })
        }

        if (alteredOptions.includes("localMediaEnabled")) {
            if (options.localMediaEnabled) {
                mediaCastTargetUrlPatterns.add(LOCAL_MEDIA_URL_PATTERN);
            } else {
                mediaCastTargetUrlPatterns.delete(LOCAL_MEDIA_URL_PATTERN);
            }

            browser.menus.update(mediaCastMenuId, {
                targetUrlPatterns: Array.from(mediaCastTargetUrlPatterns)
            });
        }
    }
}

browser.runtime.onMessage.addListener(message => {
    switch (message.subject) {
        case "optionsUpdated":
            onOptionsUpdated(message.data.alteredOptions);
            break;
    }
});

// Defines window.chrome for site compatibility
browser.contentScripts.register({
    allFrames: true
  , js: [{ file: "contentSetup.js" }]
  , matches: [ "<all_urls>" ]
  , runAt: "document_start"
});


let mediaCastTabId;
let mediaCastFrameId;

let mirrorCastTabId;
let mirrorCastFrameId;


browser.menus.onClicked.addListener(async (info, tab) => {
    const { frameId } = info;
    const { options } = await browser.storage.sync.get("options");

    // Load cast setup script
    await browser.tabs.executeScript(tab.id, {
        file: "content.js"
      , frameId
    });

    switch (info.menuItemId) {
        case "contextCast":
            mirrorCastTabId = tab.id;
            mirrorCastFrameId = frameId;

            await browser.tabs.executeScript(tab.id, {
                code: `let selectedMedia = "${info.pageUrl ? "tab" : "screen"}";
                       let FX_CAST_RECEIVER_APP_ID = "${options.mirroringAppId}";`
              , frameId
            });

            // Load mirroring sender app
            await browser.tabs.executeScript(tab.id, {
                file: "mirroringCast.js"
              , frameId
            });
            break;

        case "contextCastMedia":
            mediaCastTabId = tab.id;
            mediaCastFrameId = frameId;

            // Pass media URL to media sender app
            await browser.tabs.executeScript(tab.id, {
                code: `const srcUrl = "${info.srcUrl}";
                       const targetElementId = ${info.targetElementId};`
              , frameId
            });

            // Load media sender app
            await browser.tabs.executeScript(tab.id, {
                file: "mediaCast.js"
              , frameId
            });
            break;
    }

    // Load cast API
    await browser.tabs.executeScript(tab.id, {
        file: "shim/bundle.js"
      , frameId
    });
});


const bridgeMap = new Map();

/**
 * Initializes native application and handles message
 * forwarding.
 */
function initBridge (tabId, frameId) {
    const existingPort = bridgeMap.get(tabId);

    if (existingPort) {
        existingPort.disconnect();
        bridgeMap.delete(tabId);
    }

    const port = browser.runtime.connectNative(APPLICATION_NAME);

    if (port.error) {
        console.error(`Failed connect to ${APPLICATION_NAME}:`, port.error.message);
    } else {
        bridgeMap.set(tabId, port);
    }

    // Start version handoff
    port.postMessage({
        subject: "bridge:initialize"
      , data: EXTENSION_VERSION
    });

    port.onDisconnect.addListener(p => {
        if (p.error) {
            console.error(`${APPLICATION_NAME} disconnected:`, p.error.message);
        } else {
            console.log(`${APPLICATION_NAME} disconnected`);
        }

        bridgeMap.delete(tabId);
    });

    port.onMessage.addListener(message => {
        // Forward shim: messages
        // TODO: Integrate into messageRouter
        if (message.subject.startsWith("shim:")) {
            browser.tabs.sendMessage(tabId, message, { frameId });
        } else {
            messageRouter.handleMessage(message);
        }
    });
}


let popupTabId;
let popupOpenerTabId;

/**
 * Creates popup window for cast destination selection.
 * Refocusing other browser windows causes the popup window
 * to close and returns an API error (TODO).
 */
async function openPopup (tabId) {
    const width = 350;
    const height = 200;

    // Current window to base centered position on
    const win = await browser.windows.getCurrent();

    // Top(mid)-center position
    const centerX = win.left + (win.width / 2);
    const centerY = win.top + (win.height / 3);

    const left = Math.floor(centerX - (width / 2));
    const top = Math.floor(centerY - (height / 2));

    const popup = await browser.windows.create({
        url: "popup/index.html"
      , type: "popup"
      , width
      , height
      , left
      , top
    });

    // Store popup details for message forwarding
    popupTabId = popup.tabs[0].id;
    popupOpenerTabId = tabId;

    // Size/position not set correctly on creation (bug?)
    await browser.windows.update(popup.id, {
        width
      , height
      , left
      , top
    });

    // Close popup on other browser window focus
    browser.windows.onFocusChanged.addListener(function listener (id) {
        if (id !== browser.windows.WINDOW_ID_NONE
                && id === win.id) {
            browser.windows.onFocusChanged.removeListener(listener);
            browser.windows.remove(popup.id);
        }
    });
}


messageRouter.register("main", async (message, sender) => {
    const tabId = sender && sender.tab.id;

    switch (message.subject) {
        case "main:initialize": {
            initBridge(tabId, sender.tab.frameId);
            break;
        };

        case "main:bridgeInitialized": {
            const applicationVersion = message.data;

            /**
             * Compare installed bridge version to the version the
             * extension was built alongside and is known to be
             * compatible with.
             *
             * TODO: Determine compatibility with semver and enforce/notify
             * user.
             */
            if (applicationVersion !== APPLICATION_VERSION) {
                console.error(`Expecting ${APPLICATION_NAME} v${APPLICATION_VERSION}, found v${applicationVersion}.`
                      , semver.lt(applicationVersion, APPLICATION_VERSION)
                            ? "Try updating the native app to the latest version."
                            : "Try updating the extension to the latest version");
            }

            break;
        };

        case "main:openPopup": {
            await openPopup(tabId);
            break;
        };
    }
});

messageRouter.register("bridge", (message, sender) => {
    console.log(message);
    bridgeMap.get(sender.tab.id).postMessage(message);
});

messageRouter.register("shim", (message, sender) => {
    browser.tabs.sendMessage(popupOpenerTabId, message
          , { frameId: sender.tab.frameId });
});

messageRouter.register("popup", (message, sender) => {
    if (!popupTabId) return;

    try {
        browser.tabs.sendMessage(popupTabId, message);
    } catch (err) {
        // Popup is closed
    }
});

messageRouter.register("mirrorCast", message => {
    browser.tabs.sendMessage(mirrorCastTabId, message
          , { frameId: mirrorCastFrameId });
});
messageRouter.register("mediaCast", message => {
    browser.tabs.sendMessage(mediaCastTabId, message
          , { frameId: mediaCastFrameId });
});


browser.runtime.onMessage.addListener((message, sender) => {
    messageRouter.handleMessage(message, sender);
});


// Misc init
createMenus();
onOptionsUpdated();
