"use strict";

import defaultOptions from "./defaultOptions";
import getBridgeInfo from "./lib/getBridgeInfo";
import mediaCasting from "./lib/mediaCasting";
import nativeMessaging from "./lib/nativeMessaging";
import options, { Options } from "./lib/options";

import { getChromeUserAgent } from "./lib/userAgents";
import { getWindowCenteredProps } from "./lib/utils";

import SelectorManager from "./managers/selector";
import ShimManager from "./managers/shim";
import StatusManager from "./managers/status";

import { ReceiverSelection
       , ReceiverSelectorMediaType } from "./receiver_selectors";

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

    // Cancelled
    if (selection === null) {
        return;
    }

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

        case ReceiverSelectorMediaType.File: {
            const fileUrl = new URL(`file://${selection.filePath}`);
            const mediaSession = await mediaCasting.loadMediaUrl(
                    fileUrl.href, selection.receiver);

            console.log(mediaSession);

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
                  , await SelectorManager.getSelection());

            return;
        }

        case mediaCastMenuId: {
            const allMediaTypes =
                    ReceiverSelectorMediaType.App
                  | ReceiverSelectorMediaType.Tab
                  | ReceiverSelectorMediaType.Screen
                  | ReceiverSelectorMediaType.File;

            const selection = await SelectorManager.getSelection(
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
          , await SelectorManager.getSelection());
});


browser.runtime.onConnect.addListener(async port => {
    switch (port.name) {
        case "shim": {
            const shim = await ShimManager.createShim(port);

            shim.bridgePort.onMessage.addListener((message: Message) => {
                const [ destination ] = message.subject.split(":/");

                if (destination === "mediaCast") {
                    browser.tabs.sendMessage(
                            mediaCastTabId
                          , message
                          , { frameId: mediaCastFrameId });

                    return;
                }

                port.postMessage(message);
            });

            break;
        }
    }
});

browser.runtime.onMessage.addListener((message: Message, sender) => {
    if (message.subject.startsWith("bridge:/")) {
        const shim = ShimManager.getShimForSender(sender);
        if (shim) {
            shim.bridgePort.postMessage(message);
        }

        return;
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
}

init();
