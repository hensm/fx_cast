"use strict";

import defaultOptions, { Options } from "./defaultOptions";
import getBridgeInfo from "./lib/getBridgeInfo";
import messageRouter from "./lib/messageRouter";

import { getChromeUserAgent } from "./lib/userAgents";
import { getWindowCenteredProps } from "./lib/utils";

import { getReceiverSelectorManager
       , ReceiverSelectorManagerType
       , ReceiverSelectorMediaType
       , ReceiverSelectorSelectedEvent } from "./receiverSelectorManager";

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


type MenuId = string | number;

// Menu IDs
let mirrorCastMenuId: MenuId;
let mediaCastMenuId: MenuId;


let whitelistMenuId: MenuId;
let whitelistRecommendedMenuId: MenuId;

const whitelistMenuMap = new Map<MenuId, string>();


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
        contexts: [ "browser_action", "page", "tools_menu" ]
      , id: "contextCast"
      , title: _("contextCast")
      , visible: options.mirroringEnabled

        // Mirroring doesn't work from local files
      , documentUrlPatterns: [
            "http://*/*"
          , "https://*/*"
        ]
    });

    whitelistMenuId = await browser.menus.create({
        contexts: [ "browser_action", "tools_menu" ]
      , title: _("contextAddToWhitelist")
      , visible: false
    });

    whitelistRecommendedMenuId = await browser.menus.create({
        title: _("contextAddToWhitelistRecommended")
      , parentId: whitelistMenuId
    });

    await browser.menus.create({
        type: "separator"
      , parentId: whitelistMenuId
    });
}


browser.webNavigation.onCommitted.addListener(
        details => {
            // Only track navigation in top level contexts
            if (details.frameId === 0) {
                rebuildWhitelistMenus(details.url);
            }
        }
      , { url: [
            { schemes: [ "http", "https" ]}]
        });

browser.tabs.onActivated.addListener(async () => {
    const { url } = (await browser.tabs.query({
        active: true
      , currentWindow: true
    }))[0];

    rebuildWhitelistMenus(url);
});

async function rebuildWhitelistMenus (urlString: string) {
    const url = new URL(urlString);

    await browser.menus.update(whitelistMenuId, {
        visible: url.origin !== "null"
    });

    function addWhitelistMenuItem (pattern: string) {
        const menuId = browser.menus.create({
            title: _("contextAddToWhitelistAdvancedAdd", pattern)
          , parentId: whitelistMenuId
        });

        whitelistMenuMap.set(menuId, pattern);
    }

    for (const [ menuId ] of whitelistMenuMap) {
        // Remove all temporary menus
        if (menuId !== whitelistRecommendedMenuId) {
            browser.menus.remove(menuId);
        }

        // Clear map
        whitelistMenuMap.delete(menuId);
    }


    const recommendedPattern = `${url.origin}/*`;

    browser.menus.update(whitelistRecommendedMenuId, {
        title: _("contextAddToWhitelistRecommended", recommendedPattern)
    });

    whitelistMenuMap.set(whitelistRecommendedMenuId, recommendedPattern);


    if (url.search) {
        addWhitelistMenuItem(`${url.origin}${url.pathname}${url.search}`);
    }


    const pathTrimmed = url.pathname.endsWith("/")
        ? url.pathname.substring(0, url.pathname.length - 1)
        : url.pathname;

    const pathSegments = pathTrimmed.split("/")
            .filter(segment => segment)
            .reverse();

    if (pathSegments.length) {
        let index = 0;

        for (const pathSegment of pathSegments) {
            const partialPath = pathSegments
                    .slice(index)
                    .reverse()
                    .join("/");

            addWhitelistMenuItem(`${url.origin}/${partialPath}/*`);
            index++;
        }
    }


    const baseHost = (url.host.match(/\./g) || []).length > 1
        ? url.host.substring(url.host.indexOf(".") + 1)
        : url.host;

    // Wildcard protocol
    addWhitelistMenuItem(`*://${url.host}/*`);
    // Wildcard subdomain
    addWhitelistMenuItem(`${url.protocol}//*.${baseHost}/*`);
    // Wildcard protocol and subdomain
    addWhitelistMenuItem(`*://*.${baseHost}/*`);
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
    if (info.menuItemId === mirrorCastMenuId
     || info.menuItemId === mediaCastMenuId) {

        const { frameId } = info;
        const { options } = await browser.storage.sync.get("options");

        // Load cast setup script
        await browser.tabs.executeScript(tab.id, {
            file: "shim/content.js"
          , frameId
        });

        switch (info.menuItemId) {
            case mirrorCastMenuId: {
                mirrorCastTabId = tab.id;
                mirrorCastFrameId = frameId;

                await browser.tabs.executeScript(tab.id, {
                    code: `
                        var selectedMedia = ${info.pageUrl
                            ? ReceiverSelectorMediaType.Tab
                            : ReceiverSelectorMediaType.Screen};
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

            case mediaCastMenuId: {
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

        return;
    }


    if (info.parentMenuItemId === whitelistMenuId) {
        const matchPattern = whitelistMenuMap.get(info.menuItemId);
        const options: Options =
                (await browser.storage.sync.get("options")).options;

        // Add to whitelist
        options.userAgentWhitelist.push(matchPattern);

        // Update options
        await browser.storage.sync.set({
            options
        });
    }
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


    const { os } = await browser.runtime.getPlatformInfo();

    const receiverSelectorManager = getReceiverSelectorManager(os === "mac"
        ? ReceiverSelectorManagerType.NativeMac
        : ReceiverSelectorManagerType.Popup);

    function onReceiverSelectorManagerSelected (
            ev: ReceiverSelectorSelectedEvent) {

        port.postMessage({
            subject: "shim:/selectReceiverEnd"
          , data: ev.detail
        });
    }

    function onReceiverSelectorManagerCancelled () {
        port.postMessage({
            subject: "shim:/selectReceiverCancelled"
        });
    }

    function onReceiverSelectorManagerError () {
        // TODO: Report errors properly
        port.postMessage({
            subject: "shim:/selectReceiverCancelled"
        });
    }

    receiverSelectorManager.addEventListener("selected"
          , onReceiverSelectorManagerSelected);
    receiverSelectorManager.addEventListener("cancelled"
          , onReceiverSelectorManagerCancelled);
    receiverSelectorManager.addEventListener("error"
          , onReceiverSelectorManagerError);

    port.onDisconnect.addListener(() => {
        receiverSelectorManager.removeEventListener("selected"
              , onReceiverSelectorManagerSelected);
        receiverSelectorManager.removeEventListener("cancelled"
              , onReceiverSelectorManagerCancelled);
        receiverSelectorManager.removeEventListener("error"
              , onReceiverSelectorManagerError);
    });


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
                receiverSelectorManager.close();
                break;
            }

            case "main:/selectReceiverBegin": {
                receiverSelectorManager.open(
                        Array.from(statusBridgeReceivers.values())
                      , message.data.defaultMediaType);
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
