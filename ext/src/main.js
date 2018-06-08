"use strict";

const _ = browser.i18n.getMessage;


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
            console.log(details);
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



// <video>/<audio> "Cast..." context menu item
browser.menus.create({
    contexts: [ "audio", "video" ]
  , id: "contextCastMedia"
  , targetUrlPatterns: [
        "http://*/*"
      , "https://*/*"
    ]
  , title: _("context_media_cast")
});

browser.menus.onClicked.addListener(async (info, tab) => {
    const { frameId } = info;

    // Pass media URL to media sender app
    await browser.tabs.executeScript(tab.id, {
        code: `const srcUrl = "${info.srcUrl}";`
      , frameId
    });

    // Load app and sender API shim
    await browser.tabs.executeScript(tab.id, { file: "content.js"     , frameId })
    await browser.tabs.executeScript(tab.id, { file: "mediaCast.js"   , frameId });
    await browser.tabs.executeScript(tab.id, { file: "shim/bundle.js" , frameId });
});


const bridgeMap = new Map();

/**
 * Initializes native application and handles message
 * forwarding.
 */
function initBridge (tabId, frameId) {
    const port = browser.runtime.connectNative("caster_bridge");
    bridgeMap.set(tabId, port);

    port.onMessage.addListener(message => {
        // Forward shim: messages
        if (message.subject.startsWith("shim:")) {
            browser.tabs.sendMessage(tabId, message, {
                frameId
            });
            return;
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


// Extension messages
browser.runtime.onMessage.addListener(async (message, sender, respond) => {
    const tabId = sender.tab.id;
    const { frameId } = sender.tab;

    // Forward bridge: messages
    if (message.subject.startsWith("bridge:")) {
        bridgeMap.get(tabId).postMessage(message);
        return;
    }

    // Forward shim: messages
    if (message.subject.startsWith("shim:")) {
        browser.tabs.sendMessage(popupOpenerTabId, message, { frameId });
        return;
    }

    // Forward popup messages
    if (message.subject.startsWith("popup:")) {
        if (popupTabId) {
            try {
                browser.tabs.sendMessage(popupTabId, message);
            } catch (err) {
                // Popup is closed
            }
        }
        return;
    }

    switch (message.subject) {
        case "main:initialize":
            initBridge(tabId);
            break;

        case "main:openPopup": {
            await openPopup(tabId);
            break;
        }
    }
});
