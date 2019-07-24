"use strict";

import defaultOptions from "./defaultOptions";
import bridge from "./lib/bridge";
import mediaCasting from "./lib/mediaCasting";
import options, { Options } from "./lib/options";

import { getChromeUserAgent } from "./lib/userAgents";
import { stringify } from "./lib/utils";

import { ReceiverSelection
       , ReceiverSelectorMediaType } from "./receiver_selectors";

import { Message } from "./types";

import { CAST_FRAMEWORK_LOADER_SCRIPT_URL
       , CAST_LOADER_SCRIPT_URL } from "./lib/endpoints";


import SelectorManager from "./SelectorManager";
import StatusManager from "./StatusManager";

import { createMenus } from "./createMenus";
import { createShim } from "./createShim";


const _ = browser.i18n.getMessage;


browser.runtime.onInstalled.addListener(async details => {
    switch (details.reason) {
        // Set default options
        case "install": {
            await options.setAll(defaultOptions);

            // Call after default options have been set
            init();

            break;
        }

        // Set newly added options
        case "update": {
            await options.update(defaultOptions);
            break;
        }
    }
});



interface LoadSenderOptions {
    tabId: number;
    frameId: number;
    selection: ReceiverSelection;
}

/**
 * Loads the appropriate sender for a given receiver
 * selector response.
 */
async function loadSender (opts: LoadSenderOptions) {
    // Cancelled
    if (!opts.selection) {
        return;
    }

    switch (opts.selection.mediaType) {
        case ReceiverSelectorMediaType.Tab:
        case ReceiverSelectorMediaType.Screen: {

            await browser.tabs.executeScript(opts.tabId, {
                code: stringify`
                    window.selectedMedia = ${opts.selection.mediaType};
                    window.selectedReceiver = ${opts.selection.receiver};
                `
              , frameId: opts.frameId
            });

            await browser.tabs.executeScript(opts.tabId, {
                file: "senders/mirroringCast.js"
              , frameId: opts.frameId
            });

            break;
        }

        case ReceiverSelectorMediaType.File: {

            const fileUrl = new URL(`file://${opts.selection.filePath}`);
            const mediaSession = await mediaCasting.loadMediaUrl(
                    fileUrl.href, opts.selection.receiver);

            console.log(mediaSession);

            break;
        }
    }
}


/**
 * When the browser action is clicked, open a receiver
 * selector and load a sender for the response. The
 * mirroring sender is loaded into the current tab at the
 * top-level frame.
 */
browser.browserAction.onClicked.addListener(async tab => {
    const selection = await SelectorManager.getSelection();

    loadSender({
        tabId: tab.id
      , frameId: 0
      , selection
    });
});



interface Shim {
    bridgePort: browser.runtime.Port;
    contentPort?: browser.runtime.Port;
    contentTabId?: number;
    contentFrameId?: number;
}

const shims = new Set<Shim>();

browser.runtime.onConnect.addListener(async port => {
    if (port.name === "shim") {
        const shim = await createShim(port);

        // Add additional listener for mediaCast messages
        shim.bridgePort.onMessage.addListener((message: Message) => {
            const [ destination ] = message.subject.split(":/");
            if (destination === "mediaCast") {
                browser.tabs.sendMessage(
                        mediaCastTabId
                      , message
                      , { frameId: mediaCastFrameId });

                return;
            }
        });

        shims.add(shim);
    }
});

browser.runtime.onMessage.addListener(async (message: Message, sender) => {
    if (message.subject.startsWith("bridge:/")) {
        for (const shim of shims) {
            if (shim.contentPort
                  && shim.contentTabId === sender.tab.id
                  && shim.contentFrameId === sender.frameId) {

                shim.bridgePort.postMessage(message);
            }
        }

        return;
    }
});

StatusManager.addEventListener("serviceUp", ev => {
    for (const shim of shims) {
        shim.contentPort.postMessage({
            subject: "shim:/serviceUp"
          , data: { id: ev.detail.id }
        });
    }
});

StatusManager.addEventListener("serviceDown", ev => {
    for (const shim of shims) {
        shim.contentPort.postMessage({
            subject: "shim:/serviceDown"
          , data: { id: ev.detail.id }
        });
    }
});



let mediaCastTabId: number;
let mediaCastFrameId: number;

async function initMenus () {
    console.info("fx_cast (Debug): init (menus)");

    const { menuIdMediaCast
          , menuIdMirroringCast
          , menuIdWhitelist
          , menuIdWhitelistRecommended } = await createMenus();

    browser.menus.onClicked.addListener(async (info, tab) => {
        switch (info.menuItemId) {
            case menuIdMediaCast: {
                const allMediaTypes =
                        ReceiverSelectorMediaType.App
                      | ReceiverSelectorMediaType.Tab
                      | ReceiverSelectorMediaType.Screen
                      | ReceiverSelectorMediaType.File;

                const selection = await SelectorManager.getSelection(
                        ReceiverSelectorMediaType.App
                      , allMediaTypes);

                // Selection cancelled
                if (!selection) {
                    break;
                }

                /**
                 * If the selected media type is App, that refers to the
                 * media sender in this context, so load media sender.
                 */
                if (selection.mediaType === ReceiverSelectorMediaType.App) {
                    await browser.tabs.executeScript(tab.id, {
                        code: stringify`
                            window.selectedReceiver = ${selection.receiver};
                            window.srcUrl = ${info.srcUrl};
                            window.targetElementId = ${info.targetElementId};
                        `
                      , frameId: info.frameId
                    });

                    await browser.tabs.executeScript(tab.id, {
                        file: "senders/mediaCast.js"
                      , frameId: info.frameId
                    });

                    // Store for later
                    mediaCastTabId = tab.id;
                    mediaCastFrameId = info.frameId;
                } else {

                    // Handle other responses
                    loadSender({
                        tabId: tab.id
                      , frameId: info.frameId
                      , selection
                    });
                }

                break;
            }

            case menuIdMirroringCast: {
                const selection = await SelectorManager.getSelection();

                loadSender({
                    tabId: tab.id
                  , frameId: info.frameId
                  , selection
                });

                break;
            }
        }
    });
}


async function initRequestListener () {
    console.info("fx_cast (Debug): init (request listener)");

    type OnBeforeRequestDetails = Parameters<Parameters<
            typeof browser.webRequest.onBeforeRequest.addListener>[0]>[0];

    async function onBeforeRequest (details: OnBeforeRequestDetails) {
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

    /**
     * Sender applications load a cast_sender.js script that
     * functions as a loader for the internal chrome-extension:
     * hosted script.
     *
     * We can redirect this and inject our own script to setup
     * the API shim.
     */
    browser.webRequest.onBeforeRequest.addListener(
            onBeforeRequest
          , { urls: [
                CAST_LOADER_SCRIPT_URL
              , CAST_FRAMEWORK_LOADER_SCRIPT_URL ]}
          , [ "blocking" ]);
}


function initWhitelist () {
    console.info("fx_cast (Debug): init (whitelist)");

    type OnBeforeSendHeadersDetails = Parameters<Parameters<
            typeof browser.webRequest.onBeforeSendHeaders.addListener>[0]>[0];

    /**
     * Web apps usually only load the sender library and
     * provide cast functionality if the browser is detected
     * as Chrome, so we should rewrite the User-Agent header
     * to reflect this on whitelisted sites.
     */
    async function onBeforeSendHeaders (details: OnBeforeSendHeadersDetails) {
        const { os } = await browser.runtime.getPlatformInfo();
        const chromeUserAgent = getChromeUserAgent(os);

        const host = details.requestHeaders.find(
                header => header.name === "Host");

        for (const header of details.requestHeaders) {
            if (header.name.toLowerCase() === "user-agent") {
                /**
                 * New YouTube breaks without the default user agent string,
                 * so pretend to be an old version of Chrome to get the old
                 * site.
                 */
                if (host.value === "www.youtube.com") {
                    header.value = getChromeUserAgent(os, true);
                    break;
                }

                header.value = chromeUserAgent;
                break;
            }
        }

        return {
            requestHeaders: details.requestHeaders
        };
    }

    async function registerUserAgentWhitelist () {
        const { userAgentWhitelist
              , userAgentWhitelistEnabled } = await options.getAll();

        if (userAgentWhitelistEnabled) {
            return;
        }

        browser.webRequest.onBeforeSendHeaders.addListener(
                onBeforeSendHeaders
              , { urls: userAgentWhitelist }
              , [  "blocking", "requestHeaders" ]);
    }

    function unregisterUserAgentWhitelist () {
        browser.webRequest.onBeforeSendHeaders.removeListener(
              onBeforeSendHeaders);
    }

    // Register on first run
    registerUserAgentWhitelist();

    // Re-register when options change
    options.addEventListener("changed", ev => {
        const alteredOpts = ev.detail;

        if (alteredOpts.includes("userAgentWhitelist")
         || alteredOpts.includes("userAgentWhitelistEnabled")) {
            unregisterUserAgentWhitelist();
            registerUserAgentWhitelist();
        }
    });
}



async function init () {
    /**
     * If options haven't been set yet, we can't properly
     * initialize, so wait until init is called again in the
     * onInstalled listener.
     */
    if (!(await options.getAll())) {
        return;
    }

    console.info("fx_cast (Debug): init");


    initMenus();
    initRequestListener();
    initWhitelist();
}

init();
