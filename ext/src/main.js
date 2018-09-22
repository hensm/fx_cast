"use strict";

import messageRouter from "./messageRouter";

const _ = browser.i18n.getMessage;


browser.runtime.onInstalled.addListener(async details => {
    const initialOptions = {
        option_localMediaEnabled: true
      , option_localMediaServerPort: 9555
    };

    switch (details.reason) {

        // Set initial options
        case "install":
            browser.storage.sync.set({
                options: initialOptions
            });
            break;

        // Set newly added options
        case "update":
            const { options } = await browser.storage.sync.get("options");
            const newOptions = {};

            // Find options not already in storage
            for (const [ key, val ] of Object.entries(initialOptions)) {
                if (!options.hasOwnProperty(key)) {
                    newOptions[key] = val;
                }
            }

            // Update storage with default values of new options
            browser.storage.sync.set({
                options: {
                    ...options
                  , ...newOptions
                }
            });

            break;
    }
});


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

// Defines window.chrome for site compatibility
browser.contentScripts.register({
    allFrames: true
  , js: [{ file: "contentSetup.js" }]
  , matches: [ "<all_urls>" ]
  , runAt: "document_start"
});

// YouTube compat shim
browser.contentScripts.register({
    allFrames: true
  , js: [{ file: "compat/youtube.js" }]
  , matches: [ "*://www.youtube.com/*" ]
  , runAt: "document_start"
});


// Screen/Tab mirroring "Cast..." context menu item
browser.menus.create({
    contexts: [ "browser_action", "page" ]
  , id: "contextCast"
  , title: _("context_media_cast")
});

// <video>/<audio> "Cast..." context menu item
browser.menus.create({
    contexts: [ "audio", "video" ]
  , id: "contextCastMedia"
  , targetUrlPatterns: [
        "http://*/*"
      , "https://*/*"
      , "file://*/*"
    ]
  , title: _("context_media_cast")
});


let mediaCastTabId;
let mediaCastFrameId;

let mirrorCastTabId;
let mirrorCastFrameId;


browser.menus.onClicked.addListener(async (info, tab) => {
    const { frameId } = info;

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
                code: `let selectedMedia = "${info.pageUrl ? "tab" : "screen"}";`
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
                code: `const srcUrl = "${info.srcUrl}";`
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

    const port = browser.runtime.connectNative("fx_cast_bridge");

    if (port.error) {
        console.error("Failed connect to fx_cast_bridge:", port.error.message);
    } else {
        bridgeMap.set(tabId, port);
    }

    port.onDisconnect.addListener(p => {
        if (p.error) {
            console.error("fx_cast_bridge disconnected:", p.error.message);
        } else {
            console.log("fx_cast_bridge disconnected");
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
    const tabId = sender.tab.id;

    switch (message.subject) {
        case "main:initialize":
            initBridge(tabId, sender.tab.frameId);
            break;

        case "main:openPopup": {
            await openPopup(tabId);
            break;
        }
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
