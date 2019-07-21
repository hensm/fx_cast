"use strict";

import semver from "semver";

import defaultOptions, { Options } from "./defaultOptions";
import getBridgeInfo from "./lib/getBridgeInfo";
import nativeMessaging from "./lib/nativeMessaging";
import options from "./lib/options";

import { getChromeUserAgent } from "./lib/userAgents";
import { getWindowCenteredProps } from "./lib/utils";

import { getReceiverSelector
       , ReceiverSelection
       , ReceiverSelector
       , ReceiverSelectorCancelledEvent
       , ReceiverSelectorErrorEvent
       , ReceiverSelectorMediaType
       , ReceiverSelectorSelectedEvent
       , ReceiverSelectorType } from "./receiver_selectors";

import { Message, Receiver } from "./types";

import { ReceiverStatusMessage
       , ServiceDownMessage
       , ServiceUpMessage } from "./messageTypes";

import { CAST_FRAMEWORK_LOADER_SCRIPT_URL
       , CAST_LOADER_SCRIPT_URL } from "./endpoints";


const _ = browser.i18n.getMessage;


browser.runtime.onInstalled.addListener(async details => {
    switch (details.reason) {
        // Set default options
        case "install": {
            await options.setAll(defaultOptions);
            break;
        }
        // Set newly added options
        case "update": {
            await options.update(defaultOptions);
            break;
        }
    }

    // Call after default options have been set
    init();
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


async function initCreateMenus (opts: Options) {

    // If menus have already been created, return.
    if (mirrorCastMenuId
     || mediaCastMenuId
     || whitelistMenuId
     || whitelistRecommendedMenuId) {
        return;
    }

    /**
     * If local media casting is enabled, allow the media cast
     * menu item to appear on file URIs.
     */
    if (opts.localMediaEnabled) {
        mediaCastTargetUrlPatterns.add(LOCAL_MEDIA_URL_PATTERN);
    }

    // <video>/<audio> "Cast..." context menu item
    mediaCastMenuId = await browser.menus.create({
        contexts: [ "audio", "video" ]
      , id: "contextCastMedia"
      , targetUrlPatterns: Array.from(mediaCastTargetUrlPatterns)
      , title: _("contextCast")
      , visible: opts.mediaEnabled
    });

    // Screen/Tab mirroring "Cast..." context menu item
    mirrorCastMenuId = await browser.menus.create({
        contexts: [ "browser_action", "page", "tools_menu" ]
      , id: "contextCast"
      , title: _("contextCast")
      , visible: opts.mirroringEnabled

        // Mirroring doesn't work from local files
      , documentUrlPatterns: [
            "http://*/*"
          , "https://*/*"
        ]
    });

    whitelistMenuId = await browser.menus.create({
        contexts: [ "browser_action" ]
      , title: _("contextAddToWhitelist")
      , enabled: false
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


browser.menus.onShown.addListener(info => {
    // Only rebuild menus if whitelist menu present
    // Workaround type issues
    const menuIds = info.menuIds as unknown as number[];
    if (!menuIds.includes(whitelistMenuId as number)) {
        return;
    }

    if (!info.pageUrl) {
        browser.menus.update(whitelistMenuId, {
            enabled: false
        });

        browser.menus.refresh();
        return;
    }

    const url = new URL(info.pageUrl);
    const hasOrigin = url.origin !== "null";


    /**
     * If .origin is "null", hide top-level menu and don't
     * bother re-building submenus, since we're probably not on
     * a remote page.
     */
    browser.menus.update(whitelistMenuId, {
        enabled: hasOrigin
    });

    if (!hasOrigin) {
        browser.menus.refresh();
        return;
    }


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


    const baseHost = (url.host.match(/\./g) || []).length > 1
        ? url.host.substring(url.host.indexOf(".") + 1)
        : url.host;


    const patternRecommended = `${url.origin}/*`;
    const patternSearch = `${url.origin}${url.pathname}${url.search}`;
    const patternWildcardProtocol = `*://${url.host}/*`;
    const patternWildcardSubdomain = `${url.protocol}//*.${baseHost}/*`;
    const patternWildcardProtocolAndSubdomain = `*://*.${baseHost}/*`;


    // Update recommended menu item
    browser.menus.update(whitelistRecommendedMenuId, {
        title: _("contextAddToWhitelistRecommended", patternRecommended)
    });
    whitelistMenuMap.set(whitelistRecommendedMenuId, patternRecommended);


    if (url.search) {
        addWhitelistMenuItem(patternSearch);
    }


    /**
     * Split url path into segments and add menu items for each
     * partial path as the segments are removed.
     */
    {
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
    }


    // Add remaining menu items
    addWhitelistMenuItem(patternWildcardProtocol);
    addWhitelistMenuItem(patternWildcardSubdomain);
    addWhitelistMenuItem(patternWildcardProtocolAndSubdomain);

    browser.menus.refresh();
});


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
            await browser.tabs.executeScript(details.tabId, {
                code: `
                    window.isFramework = ${
                        details.url === CAST_FRAMEWORK_LOADER_SCRIPT_URL};
                `
              , frameId: details.frameId
              , runAt: "document_start"
            });

            await browser.tabs.executeScript(details.tabId, {
                file: "shim/contentBridge.js"
              , frameId: details.frameId
              , runAt: "document_start"
            });

            return {
                redirectUrl: browser.runtime.getURL("shim/bundle.js")
            };
        }
      , { urls: [
            CAST_LOADER_SCRIPT_URL
          , CAST_FRAMEWORK_LOADER_SCRIPT_URL
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
 * Initializes any functionality based on options state.
 */
async function initRegisterOptionalFeatures (
        opts: Options
      , alteredOptions?: Array<(keyof Options)>) {

    /**
     * Adds a webRequest listener that intercepts and modifies user
     * agent.
     */
    function register_userAgentWhitelist () {
        browser.webRequest.onBeforeSendHeaders.addListener(
                onBeforeSendHeaders
              , { urls: opts.userAgentWhitelistEnabled
                    ? opts.userAgentWhitelist
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
                visible: opts.mirroringEnabled
            });
        }

        if (alteredOptions.includes("mediaEnabled")) {
            browser.menus.update(mediaCastMenuId, {
                visible: opts.mediaEnabled
            });
        }

        if (alteredOptions.includes("localMediaEnabled")) {
            if (opts.localMediaEnabled) {
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

browser.runtime.onMessage.addListener(async message => {
    switch (message.subject) {
        case "optionsUpdated": {
            const opts = await options.getAll();
            initRegisterOptionalFeatures(opts, message.data.alteredOptions);
            break;
        }
    }
});

// Defines window.chrome for site compatibility
browser.contentScripts.register({
    allFrames: true
  , js: [{ file: "shim/content.js" }]
  , matches: [ "<all_urls>" ]
  , runAt: "document_start"
});


/**
 * Loads the appropriate sender for a given receiver
 * selector response.
 */
async function loadSenderForReceiverSelection (
        tabId: number
      , frameId: number
      , selection: ReceiverSelection) {

    switch (selection.mediaType) {
        case ReceiverSelectorMediaType.Tab:
        case ReceiverSelectorMediaType.Screen: {
            await browser.tabs.executeScript(tabId, {
                code: `
                    window.selectedMedia = ${selection.mediaType};
                    window.selectedReceiver = ${
                            JSON.stringify(selection.receiver)};
                `
              , frameId
            });

            await browser.tabs.executeScript(tabId, {
                file: "senders/mirroringCast.js"
              , frameId
            });

            break;
        }

        case ReceiverSelectorMediaType.App:
        case ReceiverSelectorMediaType.File: {
            break;
        }
    }
}


let mediaCastTabId: number;
let mediaCastFrameId: number;

browser.menus.onClicked.addListener(async (info, tab) => {
    switch (info.menuItemId) {
        case mirrorCastMenuId: {
            loadSenderForReceiverSelection(
                    tab.id, info.frameId
                  , await getUserReceiverSelection());

            return;
        }

        case mediaCastMenuId: {
            const allMediaTypes =
                    ReceiverSelectorMediaType.App
                  | ReceiverSelectorMediaType.Tab
                  | ReceiverSelectorMediaType.Screen
                  | ReceiverSelectorMediaType.File;

            const selection = await getUserReceiverSelection(
                    ReceiverSelectorMediaType.App
                  , allMediaTypes);

            if (selection && selection.mediaType
                    === ReceiverSelectorMediaType.App) {

                mediaCastTabId = tab.id;
                mediaCastFrameId = info.frameId;

                await browser.tabs.executeScript(mediaCastTabId, {
                    code: `
                        window.selectedReceiver = ${
                                JSON.stringify(selection.receiver)};
                        window.srcUrl = ${JSON.stringify(info.srcUrl)};
                        window.targetElementId = ${info.targetElementId};
                    `
                  , frameId: mediaCastFrameId
                });

                await browser.tabs.executeScript(mediaCastTabId, {
                    file: "senders/mediaCast.js"
                  , frameId: mediaCastFrameId
                });
            } else {
                // Handle other responses
                await loadSenderForReceiverSelection(
                        tab.id, info.frameId, selection);
            }

            return;
        }
    }

    if (info.parentMenuItemId === whitelistMenuId) {
        const matchPattern = whitelistMenuMap.get(info.menuItemId);
        const userAgentWhitelist = await options.get("userAgentWhitelist");

        // Add to whitelist
        userAgentWhitelist.push(matchPattern);

        // Update options
        await options.set("userAgentWhitelist", userAgentWhitelist);
    }
});

/**
 * When the browser action is clicked, open a receiver
 * selector and load a sender for the response. The
 * mirroring sender is loaded into the current tab at the
 * top-level frame.
 */
browser.browserAction.onClicked.addListener(async tab => {
    loadSenderForReceiverSelection(
            tab.id, 0
          , await getUserReceiverSelection());
});


interface Shim {
    port: browser.runtime.Port;
    bridgePort: browser.runtime.Port;
    tabId: number;
    frameId: number;
}

const shimMap = new Map<string, Shim>();


let statusBridge: browser.runtime.Port;
const statusBridgeReceivers = new Map<string, Receiver>();

/**
 * Create status bridge, set event handlers and initialize.
 */
async function initCreateStatusBridge (opts: Options) {
    // Status bridge already initialized
    if (statusBridge) {
        return;
    }

    statusBridge = nativeMessaging.connectNative(opts.bridgeApplicationName);
    statusBridge.onDisconnect.addListener(onStatusBridgeDisconnect);
    statusBridge.onMessage.addListener(onStatusBridgeMessage);

    statusBridge.postMessage({
        subject: "bridge:/initialize"
      , data: {
            shouldWatchStatus: true
        }
    });
}

/**
 * Runs once the status bridge has disconnected. Sends
 * serviceDown messages for all receivers to all shims to
 * update receiver availability, then clears the receiver
 * list.
 *
 * Attempts to reinitialize the status bridge after 10
 * seconds. If it fails immediately, this handler will be
 * triggered again and the timer is reset for another 10
 * seconds.
 */
function onStatusBridgeDisconnect () {
    // Notify shims for receiver availability
    for (const [, receiver ] of statusBridgeReceivers) {
        for (const [, shim ] of shimMap) {
            shim.port.postMessage({
                subject: "shim:/serviceDown"
              , data: { id: receiver.id }
            });
        }
    }

    // Cleanup
    statusBridgeReceivers.clear();
    statusBridge.onDisconnect.removeListener(onStatusBridgeDisconnect);
    statusBridge.onMessage.removeListener(onStatusBridgeMessage);
    statusBridge = null;

    // After 10 seconds, attempt to reinitialize
    window.setTimeout(async () => {
        const opts = await options.getAll();
        initCreateStatusBridge(opts);
    }, 10000);
}

/**
 * Handles incoming status bridge messages.
 */
async function onStatusBridgeMessage (message: Message) {
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
}


let globalReceiverSelector: ReceiverSelector;


/**
 * Opens a receiver selector with the specified
 * default/available media types.
 *
 * Returns a promise that:
 *   - Resolves to a ReceiverSelection object if selection is
 *      successful.
 *   - Resolves to null if the selection is cancelled.
 *   - Rejects if the selection fails.
 */
function getUserReceiverSelection (
        defaultMediaType =
                ReceiverSelectorMediaType.Tab
      , availableMediaTypes =
                ReceiverSelectorMediaType.Tab
              | ReceiverSelectorMediaType.Screen
              | ReceiverSelectorMediaType.File): Promise<ReceiverSelection> {

    return new Promise(async (resolve, reject) => {
        const { os } = await browser.runtime.getPlatformInfo();

        /**
         * If a receiver selector has already been created,
         * unregister it and close it if it's still open.
         */
        if (globalReceiverSelector) {
            unregister();

            if (globalReceiverSelector.isOpen) {
                globalReceiverSelector.close();
            }
        }

        globalReceiverSelector = getReceiverSelector(os === "mac"
            ? ReceiverSelectorType.NativeMac
            : ReceiverSelectorType.Popup);

        function onReceiverSelectorSelected (
                ev: ReceiverSelectorSelectedEvent) {
            console.info("fx_cast (Debug): Selected receiver", ev.detail);
            unregister();

            resolve(ev.detail);
        }

        function onReceiverSelectorCancelled (
                ev: ReceiverSelectorCancelledEvent) {
            console.info("fx_cast (Debug): Cancelled receiver selection");
            unregister();

            resolve(null);
        }

        function onReceiverSelectorError (
                ev: ReceiverSelectorErrorEvent) {
            console.error("fx_cast (Debug): Failed to select receiver");
            unregister();

            reject();
        }


        globalReceiverSelector.addEventListener("selected"
              , onReceiverSelectorSelected);
        globalReceiverSelector.addEventListener("cancelled"
              , onReceiverSelectorCancelled);
        globalReceiverSelector.addEventListener("error"
              , onReceiverSelectorError);

        function unregister () {
            globalReceiverSelector.removeEventListener("selected"
                  , onReceiverSelectorSelected);
            globalReceiverSelector.removeEventListener("cancelled"
                  , onReceiverSelectorCancelled);
            globalReceiverSelector.removeEventListener("error"
                  , onReceiverSelectorError);
        }

        globalReceiverSelector.open(
                Array.from(statusBridgeReceivers.values())
              , defaultMediaType
              , availableMediaTypes);
    });
}


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


    const applicationName = await options.get("bridgeApplicationName");

    // Spawn bridge app instance
    const bridgePort = nativeMessaging.connectNative(applicationName);

    if (bridgePort.error) {
        console.error(`Failed connect to ${applicationName}:`
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
            console.error(`${applicationName} disconnected:`
                  , bridgePort.error.message);
        } else {
            console.info(`${applicationName} disconnected`);
        }
    });

    // Handle disconnect
    port.onDisconnect.addListener(() => {
        bridgePort.disconnect();
        shimMap.delete(shimId);
    });


    bridgePort.onMessage.addListener((message: Message) => {
        const [ destination ] = message.subject.split(":/");
        if (destination === "mediaCast") {
            browser.tabs.sendMessage(
                    mediaCastTabId, message, { frameId: mediaCastFrameId });

            return;
        }

        port.postMessage(message);
    });

    port.onMessage.addListener(async (message: Message) => {
        const [ destination ] = message.subject.split(":/");
        if (destination === "bridge") {
            bridgePort.postMessage(message);
            return;
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
                if (globalReceiverSelector && globalReceiverSelector.isOpen) {
                    globalReceiverSelector.close();
                }

                break;
            }

            case "main:/selectReceiverBegin": {
                const allMediaTypes =
                        ReceiverSelectorMediaType.App
                      | ReceiverSelectorMediaType.Tab
                      | ReceiverSelectorMediaType.Screen
                      | ReceiverSelectorMediaType.File;

                try {
                    const selection = await getUserReceiverSelection(
                            ReceiverSelectorMediaType.App
                          , allMediaTypes);

                    if (!selection) {
                        // Handle cancellation
                        port.postMessage({
                            subject: "shim:/selectReceiverCancelled"
                        });

                        return;
                    }

                    /**
                     * If the media type returned from the selector has been
                     * changed, we need to cancel the current sender and switch
                     * it out for the right one.
                     *
                     * TODO: Seamlessly connect selector to the new sender
                     */
                    if (selection.mediaType !== ReceiverSelectorMediaType.App) {
                        port.postMessage({
                            subject: "shim:/selectReceiverCancelled"
                        });

                        return;
                    }

                    // Pass selection back to shim
                    port.postMessage({
                        subject: "shim:/selectReceiverEnd"
                      , data: selection
                    });
                } catch (err) {
                    // TODO: Report errors properly
                    port.postMessage({
                        subject: "shim:/selectReceiverCancelled"
                    });
                }

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
        case "shim": {
            onConnectShim(port);
            break;
        }
    }
});

browser.runtime.onMessage.addListener((message: Message, sender) => {
    if (message.subject.startsWith("bridge:/")) {
        const shimId = `${sender.tab.id}:${sender.frameId}`;
        if (shimMap.has(shimId)) {
            const shim = shimMap.get(shimId);
            shim.bridgePort.postMessage(message);
        }
    }
});


// Misc init
async function init () {
    const opts = await options.getAll();
    if (!opts) {
        return;
    }

    initCreateMenus(opts);
    initRegisterOptionalFeatures(opts);
    initCreateStatusBridge(opts);
}

init();
