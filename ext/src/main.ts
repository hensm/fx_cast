"use strict";

import defaultOptions, { Options } from "./defaultOptions";
import getBridgeInfo from "./lib/getBridgeInfo";
import messageRouter from "./lib/messageRouter";

import { getChromeUserAgent } from "./lib/userAgents";
import { getWindowCenteredProps } from "./lib/utils";

import { Message, Receiver } from "./types";

import { ReceiverStatusMessage
       , ServiceDownMessage
       , ServiceUpMessage } from "./messageTypes";

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
        }

        // Set newly added options
        case "update": {
            const { options: existingOptions }
                    = await browser.storage.sync.get("options");

            const newOptions: Partial<Options> = {};

            // Find options not already in storage
            for (const [ key, val ] of Object.entries(defaultOptions)) {
                if (!existingOptions.hasOwnProperty(key)) {
                    (newOptions as any)[key] = val;
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
        }
    }

    // Call after default options have been set
    createMenus();
});


// Menu IDs
let mirrorCastMenuId: string | number;
let mediaCastMenuId: string | number;

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
    if (!options || mirrorCastMenuId || mediaCastMenuId) {
        return;
    }

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

        // Mirroring doesn't work from local files
      , documentUrlPatterns: [
            "http://*/*"
          , "https://*/*"
        ]
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

            const isFramework = details.url === SENDER_SCRIPT_FRAMEWORK_URL;

            await browser.tabs.executeScript(details.tabId, {
                code: `window._isFramework = ${isFramework}`
              , frameId: details.frameId
              , runAt: "document_start"
            });

            await browser.tabs.executeScript(details.tabId, {
                file: "shim/content.js"
              , frameId: details.frameId
              , runAt: "document_start"
            });


            return {
                redirectUrl: browser.runtime.getURL("shim/bundle.js")
            };
        }
      , { urls: [
            SENDER_SCRIPT_URL
          , SENDER_SCRIPT_FRAMEWORK_URL
        ]}
      , [ "blocking" ]);


// Current user agent string for all whitelisted requests
let currentUAString: string;

/**
 * Web apps usually only load the sender library and
 * provide cast functionality if the browser is detected
 * as Chrome, so we should rewrite the User-Agent header
 * to reflect this on whitelisted sites.
 */
async function onBeforeSendHeaders (
        details: { requestHeaders?: browser.webRequest.HttpHeaders }) {

    const { options } = await browser.storage.sync.get("options");
    const { os } = await browser.runtime.getPlatformInfo();

    // Create Chrome UA from platform info on first run
    if (!currentUAString) {
        currentUAString = getChromeUserAgent(os);
    }

    const host = details.requestHeaders.find(
            (header: any) => header.name === "Host");

    // Find and rewrite the User-Agent header
    for (const header of details.requestHeaders) {
        if (header.name.toLowerCase() === "user-agent") {

            // TODO: Remove need for this
            if (host.value === "www.youtube.com") {
                header.value = getChromeUserAgent(os, true);
                break;
            }

            header.value = currentUAString;

            break;
        }
    }

    return {
        requestHeaders: details.requestHeaders
    };
}

/**
 * Updates any extension state based on options changes.
 */
async function onOptionsUpdated (alteredOptions?: Array<(keyof Options)>) {
    const { options } = await browser.storage.sync.get("options");

    // If options aren't set yet, return
    if (!options) {
        return;
    }

    /**
     * Adds a webRequest listener that intercepts and modifies user
     * agent.
     */
    function register_userAgentWhitelist () {
        browser.webRequest.onBeforeSendHeaders.addListener(
                onBeforeSendHeaders
              , { urls: options.userAgentWhitelistEnabled
                    ? options.userAgentWhitelist
                    : [] }
              , [  "blocking", "requestHeaders" ]);
    }

    function unregister_userAgentWhitelist () {
        browser.webRequest.onBeforeSendHeaders.removeListener(
              onBeforeSendHeaders);
    }



    if (!alteredOptions) {
        // If no altered properties specified, register all listeners
        register_userAgentWhitelist();
    } else {

        if (alteredOptions.includes("userAgentWhitelist")
             || alteredOptions.includes("userAgentWhitelistEnabled")) {

            unregister_userAgentWhitelist();
            register_userAgentWhitelist();
        }

        if (alteredOptions.includes("mirroringEnabled")) {
            browser.menus.update(mirrorCastMenuId, {
                visible: options.mirroringEnabled
            });
        }

        if (alteredOptions.includes("mediaEnabled")) {
            browser.menus.update(mediaCastMenuId, {
                visible: options.mediaEnabled
            });
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
        case "optionsUpdated": {
            onOptionsUpdated(message.data.alteredOptions);
            break;
        }
    }
});

// Defines window.chrome for site compatibility
browser.contentScripts.register({
    allFrames: true
  , js: [{ file: "shim/contentSetup.js" }]
  , matches: [ "<all_urls>" ]
  , runAt: "document_start"
});


let mediaCastTabId: number;
let mediaCastFrameId: number;

let mirrorCastTabId: number;
let mirrorCastFrameId: number;


browser.menus.onClicked.addListener(async (info, tab) => {
    const { frameId } = info;
    const { options } = await browser.storage.sync.get("options");

    // Load cast setup script
    await browser.tabs.executeScript(tab.id, {
        file: "shim/content.js"
      , frameId
    });

    switch (info.menuItemId) {
        case "contextCast": {
            mirrorCastTabId = tab.id;
            mirrorCastFrameId = frameId;

            await browser.tabs.executeScript(tab.id, {
                code: `
                    var selectedMedia = "${info.pageUrl ? "tab" : "screen"}";
                    var FX_CAST_RECEIVER_APP_ID = "${options.mirroringAppId}";
                `
              , frameId
            });

            // Load mirroring sender app
            await browser.tabs.executeScript(tab.id, {
                file: "mirroringCast.js"
              , frameId
            });

            break;
        }

        case "contextCastMedia": {
            mediaCastTabId = tab.id;
            mediaCastFrameId = frameId;

            // Pass media URL to media sender app
            await browser.tabs.executeScript(tab.id, {
                code: `var srcUrl = "${info.srcUrl}";
                       var targetElementId = ${info.targetElementId};`
              , frameId
            });

            // Load media sender app
            await browser.tabs.executeScript(tab.id, {
                file: "mediaCast.js"
              , frameId
            });

            break;
        }
    }

    // Load cast API
    await browser.tabs.executeScript(tab.id, {
        file: "shim/bundle.js"
      , frameId
    });
});


let popupWinId: number;
let popupShimId: string;
let popupPort: browser.runtime.Port;

/**
 * Creates popup window for cast destination selection.
 * Refocusing other browser windows causes the popup window
 * to close and returns an API error.
 */
async function openPopup (shimId: string) {
    // Current window to base centered position on
    const win = await browser.windows.getCurrent();
    const centeredProps = getWindowCenteredProps(win, 350, 200);

    const popup = await browser.windows.create({
        url: "ui/popup/index.html"
      , type: "popup"
      , ...centeredProps
    });

    // Store popup details for message forwarding
    popupWinId = popup.id;
    popupShimId = shimId;

    // Size/position not set correctly on creation (bug?)
    await browser.windows.update(popup.id, {
        ...centeredProps
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

// Track popup close
browser.windows.onRemoved.addListener(id => {
    if (id === popupWinId) {
        shimMap.get(popupShimId).port.postMessage({
            subject: "shim:/popupClosed"
        });

        popupWinId = null;
        popupShimId = null;
        popupPort = null;
    }
});


const shimMap = new Map();

async function onConnectShim (port: browser.runtime.Port) {
    const bridgeInfo = await getBridgeInfo();
    if (bridgeInfo && !bridgeInfo.isVersionCompatible) {
        return;
    }


    const tabId = port.sender.tab.id;
    const frameId = port.sender.frameId;
    const shimId = `${tabId}:${frameId}`;

    // Disconnect existing shim
    if (shimMap.has(shimId)) {
        shimMap.get(shimId).port.disconnect();
        shimMap.delete(shimId);
    }

    // Spawn bridge app instance
    const bridgePort = browser.runtime.connectNative(APPLICATION_NAME);

    if (bridgePort.error) {
        console.error(`Failed connect to ${APPLICATION_NAME}:`
              , bridgePort.error.message);
    }

    shimMap.set(shimId, {
        port
      , bridgePort
      , tabId
      , frameId
    });

    bridgePort.onDisconnect.addListener(() => {
        if (bridgePort.error) {
            console.error(`${APPLICATION_NAME} disconnected:`
                  , bridgePort.error.message);
        } else {
            console.info(`${APPLICATION_NAME} disconnected`);
        }
    });

    // Handle disconnect
    port.onDisconnect.addListener(() => {
        bridgePort.disconnect();
        shimMap.delete(shimId);
    });


    bridgePort.onMessage.addListener((message: Message) => {
        port.postMessage(message);
    });

    port.onMessage.addListener(async (message: Message) => {
        const [ destination ] = message.subject.split(":/");
        switch (destination) {
            case "bridge": {
                bridgePort.postMessage(message);
                break;
            }
        }

        switch (message.subject) {
            case "main:/openPopup": {
                /**
                 * If popup already open, reassign to new shim,
                 * otherwise create a new popup.
                 */
                if (popupWinId) {

                    // Reassign popup to new shim
                    popupPort.postMessage({
                        subject: "popup:/assignShim"
                      , data: {
                            tabId
                          , frameId
                        }
                    });

                    /**
                     * Notify shim that existing popup has closed and
                     * to re-populate receiver list for new popup.
                     */
                    port.postMessage({ subject: "shim:/popupClosed" });
                    port.postMessage({ subject: "shim:/popupReady" });
                } else {
                    await openPopup(shimId);
                }

                break;
            }

            default: {
                // TODO: Remove need for this
                messageRouter.handleMessage(message);
                break;
            }
        }
    });

    port.postMessage({
        subject: "shim:/initialized"
      , data: bridgeInfo
    });
}

function onConnectPopup (port: browser.runtime.Port) {
    if (popupPort) {
        popupPort.disconnect();
    }

    popupPort = port;

    const { tabId, frameId } = shimMap.get(popupShimId);
    port.postMessage({
        subject: "popup:/assignShim"
      , data: {
            tabId
          , frameId
        }
    });
}

browser.runtime.onConnect.addListener(port => {
    switch (port.name) {
        case "shim":
            onConnectShim(port);
            break;
        case "popup":
            onConnectPopup(port);
            break;
    }
});


const statusBridge = browser.runtime.connectNative(APPLICATION_NAME);
const statusBridgeReceivers = new Map<string, Receiver>();

statusBridge.onMessage.addListener((message: Message)  => {
    switch (message.subject) {

        case "shim:/serviceUp": {
            const serviceUpMessage = message as ServiceUpMessage;
            const receiver = serviceUpMessage.data;

            statusBridgeReceivers.set(receiver.id, receiver);

            break;
        }

        case "shim:/serviceDown": {
            const serviceDownMessage = (message as ServiceDownMessage);
            const { id } = serviceDownMessage.data;

            if (statusBridgeReceivers.has(id)) {
                statusBridgeReceivers.delete(id);
            }

            break;
        }

        case "receiverStatus": {
            const receiverStatusMessage = message as ReceiverStatusMessage;
            const { id, status } = receiverStatusMessage.data;

            const receiver = statusBridgeReceivers.get(id);

            // Merge new status with old status
            statusBridgeReceivers.set(id, {
                ...receiver
              , status: {
                    ...receiver.status
                  , ...status
                }
            });

            break;
        }
    }
});

statusBridge.postMessage({
    subject: "bridge:/initialize"
  , data: {
        shouldWatchStatus: true
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


// Forward messages into messageRouter
browser.runtime.onMessage.addListener((message, sender) => {
    messageRouter.handleMessage(message, {
        tabId: sender.tab.id
      , frameId: sender.frameId
    });
});


// Misc init
createMenus();
onOptionsUpdated();
