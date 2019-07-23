"use strict";

import defaultOptions from "./defaultOptions";
import mediaCasting from "./lib/mediaCasting";
import options, { Options } from "./lib/options";

import { getChromeUserAgent } from "./lib/userAgents";

import { ReceiverSelection
       , ReceiverSelectorMediaType } from "./receiver_selectors";

import { Message } from "./types";

import { CAST_FRAMEWORK_LOADER_SCRIPT_URL
       , CAST_LOADER_SCRIPT_URL } from "./endpoints";

import MenuManager from "./managers/menu";
import SelectorManager from "./managers/selector";
import ShimManager from "./managers/shim";
import StatusManager from "./managers/status";


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

MenuManager.addEventListener("mediaCastMenuClicked", async ev => {
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

        mediaCastTabId = ev.detail.tab.id;
        mediaCastFrameId = ev.detail.info.frameId;

        await browser.tabs.executeScript(mediaCastTabId, {
            code: `
                window.selectedReceiver = ${
                        JSON.stringify(selection.receiver)};
                window.srcUrl = ${JSON.stringify(ev.detail.info.srcUrl)};
                window.targetElementId = ${ev.detail.info.targetElementId};
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
                ev.detail.tab.id, ev.detail.info.frameId, selection);
    }
});

MenuManager.addEventListener("mirrorCastMenuClicked", async ev => {
    loadSenderForReceiverSelection(
            ev.detail.tab.id
          , ev.detail.info.frameId
          , await SelectorManager.getSelection());
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

browser.runtime.onMessage.addListener(async (message: Message, sender) => {
    if (message.subject.startsWith("bridge:/")) {
        const shim = ShimManager.getShimForSender(sender);
        if (shim) {
            shim.bridgePort.postMessage(message);
        }

        return;
    }

    switch (message.subject) {
        case "optionsUpdated": {
            const opts = await options.getAll();
            initRegisterOptionalFeatures(opts, message.data.alteredOptions);
            break;
        }
    }
});



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
            browser.menus.update(MenuManager.mirrorCastMenuId, {
                visible: opts.mirroringEnabled
            });
        }

        if (alteredOptions.includes("mediaEnabled")) {
            browser.menus.update(MenuManager.mediaCastMenuId, {
                visible: opts.mediaEnabled
            });
        }

        if (alteredOptions.includes("localMediaEnabled")) {
            MenuManager.isLocalMediaEnabled = opts.localMediaEnabled;
        }
    }
}

// Misc init
async function init () {
    const opts = await options.getAll();
    if (!opts) {
        return;
    }

    MenuManager.createMenus();
    initRegisterOptionalFeatures(opts);
}

init();
