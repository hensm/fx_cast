"use strict";

import defaultOptions from "../defaultOptions";
import loadSender from "../lib/loadSender";
import logger from "../lib/logger";
import messaging from "../lib/messaging";
import options from "../lib/options";
import bridge from "../lib/bridge";

import { getChromeUserAgent } from "../lib/userAgents";
import { getMediaTypesForPageUrl, stringify } from "../lib/utils";

import { CAST_FRAMEWORK_LOADER_SCRIPT_URL
       , CAST_LOADER_SCRIPT_URL } from "../lib/endpoints";

import { ReceiverSelectionActionType
       , ReceiverSelectorMediaType } from "./receiverSelector";

import ReceiverSelectorManager
        from "./receiverSelector/ReceiverSelectorManager";

import ShimManager from "./ShimManager";
import StatusManager from "./StatusManager";


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


async function initBrowserAction () {
    logger.info("init (browser action)");

    /**
     * When the browser action is clicked, open a receiver
     * selector and load a sender for the response. The
     * mirroring sender is loaded into the current tab at the
     * top-level frame.
     */
    browser.browserAction.onClicked.addListener(async tab => {
        if (tab.id === undefined) {
            throw logger.error("Tab ID not found in browser action handler.");
        }

        const selection = await ReceiverSelectorManager.getSelection(tab.id);

        if (selection) {
            loadSender({
                tabId: tab.id
              , frameId: 0
              , selection
            });
        }
    });
}


async function initMenus () {
    logger.info("init (menus)");

    const URL_PATTERN_HTTP = "http://*/*";
    const URL_PATTERN_HTTPS = "https://*/*";
    const URL_PATTERN_FILE = "file://*/*";

    const URL_PATTERNS_REMOTE = [ URL_PATTERN_HTTP, URL_PATTERN_HTTPS ];
    const URL_PATTERNS_ALL = [ ...URL_PATTERNS_REMOTE, URL_PATTERN_FILE ];


    type MenuId = string | number;

    let menuIdCast: MenuId;
    let menuIdMediaCast: MenuId;
    let menuIdWhitelist: MenuId;
    let menuIdWhitelistRecommended: MenuId;

    const whitelistChildMenuPatterns = new Map<MenuId, string>();


    const opts = await options.getAll();

    // Global "Cast..." menu item
    menuIdCast = browser.menus.create({
        contexts: [ "browser_action", "page", "tools_menu" ]
      , title: _("contextCast")
    });

    // <video>/<audio> "Cast..." context menu item
    menuIdMediaCast = browser.menus.create({
        contexts: [ "audio", "video" ]
      , title: _("contextCast")
      , visible: opts.mediaEnabled
      , targetUrlPatterns: opts.localMediaEnabled
            ? URL_PATTERNS_ALL
            : URL_PATTERNS_REMOTE
    });


    menuIdWhitelist = browser.menus.create({
        contexts: [ "browser_action" ]
      , title: _("contextAddToWhitelist")
      , enabled: false
    });

    menuIdWhitelistRecommended = browser.menus.create({
        title: _("contextAddToWhitelistRecommended")
      , parentId: menuIdWhitelist
    });

    browser.menus.create({
        type: "separator"
      , parentId: menuIdWhitelist
    });


    browser.menus.onClicked.addListener(async (info, tab) => {
        if (info.parentMenuItemId === menuIdWhitelist) {
            const pattern = whitelistChildMenuPatterns.get(info.menuItemId);
            if (!pattern) {
                throw logger.error(`Whitelist pattern not found for menu item ID ${info.menuItemId}.`);
            }

            const whitelist = await options.get("userAgentWhitelist");

            // Add to whitelist and update options
            whitelist.push(pattern);
            await options.set("userAgentWhitelist", whitelist);

            return;
        }


        if (tab?.id === undefined) {
            throw logger.error("Menu handler tab ID not found.");
        }
        if (!info.pageUrl) {
            throw logger.error("Menu handler page URL not found.");
        }


        const availableMediaTypes = getMediaTypesForPageUrl(info.pageUrl);

        switch (info.menuItemId) {
            case menuIdCast: {
                const selection = await ReceiverSelectorManager.getSelection(
                        tab.id, info.frameId);

                // Selection cancelled
                if (!selection) {
                    break;
                }

                loadSender({
                    tabId: tab.id
                  , frameId: info.frameId
                  , selection
                });

                break;
            }

            case menuIdMediaCast: {
                const selection = await ReceiverSelectorManager.getSelection(
                        tab.id, info.frameId, true);

                // Selection cancelled
                if (!selection) {
                    break;
                }

                switch (selection.actionType) {
                    case ReceiverSelectionActionType.Cast: {
                        /**
                         * If the selected media type is App, that refers to the
                         * media sender in this context, so load media sender.
                         */
                        if (selection.mediaType ===
                                ReceiverSelectorMediaType.App) {

                            await browser.tabs.executeScript(tab.id, {
                                code: stringify`
                                    window.receiver = ${selection.receiver};
                                    window.mediaUrl = ${info.srcUrl};
                                    window.targetElementId = ${
                                            info.targetElementId};
                                `
                              , frameId: info.frameId
                            });

                            await browser.tabs.executeScript(tab.id, {
                                file: "senders/media/bundle.js"
                              , frameId: info.frameId
                            });
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
                }

                break;
            }
        }
    });

    // Hide cast item on extension pages
    browser.menus.onShown.addListener(info => {
        if (info.pageUrl?.startsWith(browser.runtime.getURL(""))) {
            browser.menus.update(menuIdCast, {
                visible: false
            });

            browser.menus.refresh();
        }
    });
    browser.menus.onHidden.addListener(() => {
        browser.menus.update(menuIdCast, {
            visible: true
        });
    });

    browser.menus.onShown.addListener(async info => {
        // Only rebuild menus if whitelist menu present
        // WebExt typings are broken again here, so ugly casting
        const menuIds = info.menuIds as unknown as number[];
        if (!menuIds.includes(menuIdWhitelist as number)) {
            return;
        }


        /**
         * If page URL doesn't exist, we're not on a page and have
         * nothing to whitelist, so disable the menu and return.
         */
        if (!info.pageUrl) {
            browser.menus.update(menuIdWhitelist, {
                enabled: false
            });

            browser.menus.refresh();
            return;
        }


        const url = new URL(info.pageUrl);
        const urlHasOrigin = url.origin !== "null";

        /**
         * If the page URL doesn't have an origin, we're not on a
         * remote page and have nothing to whitelist, so disable the
         * menu and return.
         */
        if (!urlHasOrigin) {
            browser.menus.update(menuIdWhitelist, {
                enabled: false
            });

            browser.menus.refresh();
            return;
        }


        // Enable the whitelist menu
        browser.menus.update(menuIdWhitelist, {
            enabled: true
        });


        for (const [ menuId ] of whitelistChildMenuPatterns) {
            // Clear all page-specific temporary menus
            if (menuId !== menuIdWhitelistRecommended) {
                browser.menus.remove(menuId);
            }

            whitelistChildMenuPatterns.delete(menuId);
        }


        // If there is more than one subdomain, get the base domain
        const baseDomain = (url.host.match(/\./g) || []).length > 1
            ? url.host.substring(url.host.indexOf(".") + 1)
            : url.host;

        const patternRecommended = `${url.origin}/*`;
        const patternSearch = `${url.origin}${url.pathname}${url.search}`;
        const patternWildcardProtocol = `*://${url.host}/*`;
        const patternWildcardSubdomain = `${url.protocol}//*.${baseDomain}/*`;
        const patternWildcardProtocolAndSubdomain = `*://*.${baseDomain}/*`;


        // Update recommended menu item
        browser.menus.update(menuIdWhitelistRecommended, {
            title: _("contextAddToWhitelistRecommended", patternRecommended)
        });

        whitelistChildMenuPatterns.set(
                menuIdWhitelistRecommended, patternRecommended);


        if (url.search) {
            const whitelistSearchMenuId = browser.menus.create({
                title: _("contextAddToWhitelistAdvancedAdd", patternSearch)
              , parentId: menuIdWhitelist
            });

            whitelistChildMenuPatterns.set(
                    whitelistSearchMenuId, patternSearch);
        }


        /**
         * Split URL path into segments and add menu items for each
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
                for (let i = 0; i < pathSegments.length; i++) {
                    const partialPath = pathSegments
                            .slice(i)
                            .reverse()
                            .join("/");

                    const pattern = `${url.origin}/${partialPath}/*`;

                    const partialPathMenuId = browser.menus.create({
                        title: _("contextAddToWhitelistAdvancedAdd", pattern)
                      , parentId: menuIdWhitelist
                    });

                    whitelistChildMenuPatterns.set(
                            partialPathMenuId, pattern);
                }
            }
        }


        const wildcardProtocolMenuId = browser.menus.create({
            title: _("contextAddToWhitelistAdvancedAdd"
                  , patternWildcardProtocol)
          , parentId: menuIdWhitelist
        });

        whitelistChildMenuPatterns.set(
                wildcardProtocolMenuId, patternWildcardProtocol);


        const wildcardSubdomainMenuId = browser.menus.create({
            title: _("contextAddToWhitelistAdvancedAdd"
                  , patternWildcardSubdomain)
          , parentId: menuIdWhitelist
        });

        whitelistChildMenuPatterns.set(
                wildcardSubdomainMenuId, patternWildcardSubdomain);


        const wildcardProtocolAndSubdomainMenuId = browser.menus.create({
            title: _("contextAddToWhitelistAdvancedAdd"
                  , patternWildcardProtocolAndSubdomain)
          , parentId: menuIdWhitelist
        });

        whitelistChildMenuPatterns.set(
                wildcardProtocolAndSubdomainMenuId
              , patternWildcardProtocolAndSubdomain);


        await browser.menus.refresh();
    });


    options.addEventListener("changed", async ev => {
        const alteredOpts = ev.detail;
        const newOpts = await options.getAll();

        if (alteredOpts.includes("mediaEnabled")) {
            browser.menus.update(menuIdMediaCast, {
                visible: newOpts.mediaEnabled
            });
        }

        if (alteredOpts.includes("localMediaEnabled")) {
            browser.menus.update(menuIdMediaCast, {
                targetUrlPatterns: newOpts.localMediaEnabled
                    ? URL_PATTERNS_ALL
                    : URL_PATTERNS_REMOTE
            });
        }
    });
}


async function initRequestListener () {
    logger.info("init (request listener)");

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


async function initWhitelist () {
    logger.info("init (whitelist)");

    type OnBeforeSendHeadersDetails = Parameters<Parameters<
            typeof browser.webRequest.onBeforeSendHeaders.addListener>[0]>[0] & {
        // Missing on @types/firefox-webext-browser
        frameAncestors?: Array<{ url: string, frameId: number }>
    };

    const originUrlCache: string[] = [];
    const chromeUserAgent = getChromeUserAgent(
            (await browser.runtime.getPlatformInfo()).os, true);

    /**
     * Web apps usually only load the sender library and
     * provide cast functionality if the browser is detected
     * as Chrome, so we should rewrite the User-Agent header
     * to reflect this on whitelisted sites.
     */
    async function onBeforeSendHeaders (details: OnBeforeSendHeadersDetails) {
        if (!details.requestHeaders) {
            throw logger.error("OnBeforeSendHeaders handler details missing requestHeaders.");
        }

        if (details.originUrl && !originUrlCache.includes(details.originUrl)) {
            originUrlCache.push(details.originUrl);
        }

        const host = details.requestHeaders.find(
                header => header.name === "Host");

        for (const header of details.requestHeaders) {
            const { os } = await browser.runtime.getPlatformInfo();

            if (header.name === "User-Agent") {
                header.value = chromeUserAgent;
                break;
            }
        }

        return {
            requestHeaders: details.requestHeaders
        };
    }

    function handleResourceRequests (details: OnBeforeSendHeadersDetails) {
        if (!details.requestHeaders || !details.frameAncestors) {
            return;
        }

        for (const ancestor of details.frameAncestors) {
            if (originUrlCache.includes(ancestor.url)) {
                for (const header of details.requestHeaders) {
                    if (header.name === "User-Agent") {
                        header.value = chromeUserAgent;
                    }
                }

                return {
                    requestHeaders: details.requestHeaders
                };
            }
        }
    }

    async function registerUserAgentWhitelist () {
        const { userAgentWhitelist
              , userAgentWhitelistEnabled } = await options.getAll();

        if (!userAgentWhitelistEnabled) {
            return;
        }

        browser.webRequest.onBeforeSendHeaders.addListener(
                handleResourceRequests
              , { urls: [ "<all_urls>" ] }
              , [ "blocking", "requestHeaders" ]);

        browser.webRequest.onBeforeSendHeaders.addListener(
                onBeforeSendHeaders
              , { urls: userAgentWhitelist }
              , [  "blocking", "requestHeaders" ]);
    }

    function unregisterUserAgentWhitelist () {
        originUrlCache.length = 0;

        browser.webRequest.onBeforeSendHeaders
                .removeListener(handleResourceRequests);
        browser.webRequest.onBeforeSendHeaders
                .removeListener(onBeforeSendHeaders);
    }

    // Register on first run
    await registerUserAgentWhitelist();

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


async function initMediaOverlay () {
    logger.info("init (media overlay)");

    let contentScript: browser.contentScripts.RegisteredContentScript;

    async function registerMediaOverlayContentScript () {
        if (!(await options.get("mediaOverlayEnabled"))) {
            return;
        }

        try {
            contentScript = await browser.contentScripts.register({
                allFrames: true
              , js: [{ file: "senders/media/overlay/overlayContentLoader.js" }]
              , matches: [ "<all_urls>" ]
              , runAt: "document_start"
            });
        } catch (err) {
            logger.error("Failed to register media overlay");
        }
    }

    async function unregisterMediaOverlayContentScript () {
        await contentScript?.unregister();
    }


    registerMediaOverlayContentScript();

    options.addEventListener("changed", async ev => {
        const alteredOpts = ev.detail;

        if (alteredOpts.includes("mediaOverlayEnabled")) {
            await unregisterMediaOverlayContentScript();
            await registerMediaOverlayContentScript();
        }
    });
}


async function checkBridgeCompat () {
    logger.info("checking for bridge...");

    const info = await bridge.getInfo();

    if (info.isVersionCompatible) {
        logger.info("... bridge compatible!");
    } else {
        logger.info("... bridge incompatible!");

        const updateNotificationId = await browser.notifications.create({
            type: "basic"
          , title: `${
                  _("extensionName")} — ${_("optionsBridgeIssueStatusTitle")}`
          , message: info.isVersionOlder
                ? _("optionsBridgeOlderAction")
                : _("optionsBridgeNewerAction")
        });

        browser.notifications.onClicked.addListener(notificationId => {
            if (notificationId !== updateNotificationId) {
                return;
            }

            browser.tabs.create({
                url: `https://github.com/hensm/fx_cast/releases/tag/v${
                        info.expectedVersion}`
            });
        });
    }
}


let isInitialized = false;

async function init () {
    if (isInitialized) {
        return;
    }

    /**
     * If options haven't been set yet, we can't properly
     * initialize, so wait until init is called again in the
     * onInstalled listener.
     */
    if (!(await options.getAll())) {
        return;
    }

    logger.info("init");
    isInitialized = true;

    await checkBridgeCompat();

    await StatusManager.init();
    await ShimManager.init();

    await initMenus();
    await initRequestListener();
    await initWhitelist();
    await initMediaOverlay();
    await initBrowserAction();


    /**
     * When a message port connection with the name "shim" is
     * established, pass it to createShim to handle the setup
     * and maintenance.
     */
    messaging.onConnect.addListener(async port => {
        if (port.name === "shim") {
            ShimManager.createShim(port as any);
        }
    });
}

init();
