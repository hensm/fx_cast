"use strict";

import defaultOptions, { Options } from "./defaultOptions";
import getBridgeInfo from "./lib/getBridgeInfo";
import messageRouter from "./lib/messageRouter";

import { getChromeUserAgent } from "./lib/userAgents";
import { getWindowCenteredProps } from "./lib/utils";

import { ReceiverSelectorMediaType
       , ReceiverSelectorSelectedEvent
       , PopupReceiverSelectorManager
       , NativeMacReceiverSelectorManager } from "./receiverSelectorManager";

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



interface Shim {
    port: browser.runtime.Port;
    bridgePort: browser.runtime.Port;
    tabId: number;
    frameId: number;
}

const shimMap = new Map<string, Shim>();

const statusBridge = browser.runtime.connectNative(APPLICATION_NAME);
const statusBridgeReceivers = new Map<string, Receiver>();

statusBridge.onMessage.addListener(async (message: Message)  => {
    switch (message.subject) {
        case "shim:/serviceUp": {
            const receiver = (message as ServiceUpMessage).data;
            statusBridgeReceivers.set(receiver.id, receiver);

            // Forward update to shims
            for (const shim of shimMap.values()) {
                shim.port.postMessage({
                    subject: "shim:/serviceUp"
                  , data: { id: receiver.id }
                });
            }

            break;
        }

        case "shim:/serviceDown": {
            const { id } = (message as ServiceDownMessage).data;

            if (statusBridgeReceivers.has(id)) {
                statusBridgeReceivers.delete(id);
            }

            // Forward update to shims
            for (const shim of shimMap.values()) {
                shim.port.postMessage({
                    subject: "shim:/serviceDown"
                  , data: { id }
                });
            }

            break;
        }

        case "receiverStatus": {
            const { id, status } = (message as ReceiverStatusMessage).data;

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
        mode: "status"
    }
});


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
            case "main:/shimInitialized": {

                // Send existing receivers as serviceUp messages
                for (const receiver of statusBridgeReceivers.values()) {
                    port.postMessage({
                        subject: "shim:/serviceUp"
                      , data: { id: receiver.id }
                    });
                }

                break;
            }

            case "main:/sessionCreated": {
                PopupReceiverSelectorManager.close();
                break;
            }

            case "main:/selectReceiverBegin": {
                PopupReceiverSelectorManager.open(
                        Array.from(statusBridgeReceivers.values())
                      , message.data.defaultMediaType);

                PopupReceiverSelectorManager.addEventListener("selected"
                      , (ev: ReceiverSelectorSelectedEvent) => {

                    port.postMessage({
                        subject: "shim:/selectReceiverEnd"
                      , data: {
                            receiver: ev.detail.receiver
                        }
                    });
                });

                PopupReceiverSelectorManager.addEventListener("cancelled", () => {
                    port.postMessage({
                        subject: "shim:/selectReceiverCancelled"
                    });
                });

                PopupReceiverSelectorManager.addEventListener("error", () => {
                    // TODO: Report errors properly
                    port.postMessage({
                        subject: "shim:/selectReceiverCancelled"
                    });
                });

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

browser.runtime.onConnect.addListener(port => {
    switch (port.name) {
        case "shim":
            onConnectShim(port);
            break;
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
