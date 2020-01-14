"use strict";

import defaultOptions from "../defaultOptions";
import loadSender from "../lib/loadSender";
import options from "../lib/options";

import { getChromeUserAgent } from "../lib/userAgents";
import { getMediaTypesForPageUrl, stringify } from "../lib/utils";

import { CAST_FRAMEWORK_LOADER_SCRIPT_URL
       , CAST_LOADER_SCRIPT_URL } from "../lib/endpoints";

import { ReceiverSelectorMediaType } from "./receiverSelector";

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


function initBrowserAction () {
    /*browser.browserAction.disable();

    function onServiceChange () {
        if (StatusManager.getReceivers().length) {
            browser.browserAction.enable();
        } else {
            browser.browserAction.disable();
        }
    }

    StatusManager.addEventListener("serviceUp", onServiceChange);
    StatusManager.addEventListener("serviceDown", onServiceChange);*/


    /**
     * When the browser action is clicked, open a receiver
     * selector and load a sender for the response. The
     * mirroring sender is loaded into the current tab at the
     * top-level frame.
     */
    browser.browserAction.onClicked.addListener(async tab => {
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
    console.info("fx_cast (Debug): init (menus)");

    const URL_PATTERN_HTTP = "http://*/*";
    const URL_PATTERN_HTTPS = "https://*/*";
    const URL_PATTERN_FILE = "file://*/*";

    const URL_PATTERNS_REMOTE = [ URL_PATTERN_HTTP, URL_PATTERN_HTTPS ];
    const URL_PATTERNS_ALL = [ ...URL_PATTERNS_REMOTE, URL_PATTERN_FILE ];


    type MenuId = string | number;

    let menuIdMediaCast: MenuId;
    let menuIdMirroringCast: MenuId;
    let menuIdWhitelist: MenuId;
    let menuIdWhitelistRecommended: MenuId;

    const whitelistChildMenuPatterns = new Map<MenuId, string>();


    const opts = await options.getAll();

    // <video>/<audio> "Cast..." context menu item
    menuIdMediaCast = await browser.menus.create({
        contexts: [ "audio", "video" ]
      , title: _("contextCast")
      , visible: opts.mediaEnabled
      , targetUrlPatterns: opts.localMediaEnabled
            ? URL_PATTERNS_ALL
            : URL_PATTERNS_REMOTE
    });

    // Screen/Tab mirroring "Cast..." context menu item
    menuIdMirroringCast = await browser.menus.create({
        contexts: [ "browser_action", "page", "tools_menu" ]
      , title: _("contextCast")
      , visible: opts.mirroringEnabled

        // Mirroring doesn't work from file:// urls
      , documentUrlPatterns: URL_PATTERNS_REMOTE
    });


    menuIdWhitelist = await browser.menus.create({
        contexts: [ "browser_action" ]
      , title: _("contextAddToWhitelist")
      , enabled: false
    });

    menuIdWhitelistRecommended = await browser.menus.create({
        title: _("contextAddToWhitelistRecommended")
      , parentId: menuIdWhitelist
    });

    await browser.menus.create({
        type: "separator"
      , parentId: menuIdWhitelist
    });


    browser.menus.onClicked.addListener(async (info, tab) => {
        if (info.parentMenuItemId === menuIdWhitelist) {
            const pattern = whitelistChildMenuPatterns.get(info.menuItemId);
            const whitelist = await options.get("userAgentWhitelist");

            // Add to whitelist and update options
            whitelist.push(pattern);
            await options.set("userAgentWhitelist", whitelist);

            return;
        }


        const availableMediaTypes = getMediaTypesForPageUrl(info.pageUrl);

        switch (info.menuItemId) {
            case menuIdMediaCast: {
                const selection = await ReceiverSelectorManager.getSelection(
                        tab.id, info.frameId);

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
                            window.receiver = ${selection.receiver};
                            window.mediaUrl = ${info.srcUrl};
                            window.targetElementId = ${info.targetElementId};
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

            case menuIdMirroringCast: {
                const selection = await ReceiverSelectorManager.getSelection(
                        tab.id, info.frameId);

                loadSender({
                    tabId: tab.id
                  , frameId: info.frameId
                  , selection
                });

                break;
            }
        }
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
            const whitelistSearchMenuId = await browser.menus.create({
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

                    const partialPathMenuId = await browser.menus.create({
                        title: _("contextAddToWhitelistAdvancedAdd", pattern)
                      , parentId: menuIdWhitelist
                    });

                    whitelistChildMenuPatterns.set(
                            partialPathMenuId, pattern);
                }
            }
        }


        const wildcardProtocolMenuId = await browser.menus.create({
            title: _("contextAddToWhitelistAdvancedAdd"
                  , patternWildcardProtocol)
          , parentId: menuIdWhitelist
        });

        whitelistChildMenuPatterns.set(
                wildcardProtocolMenuId, patternWildcardProtocol);


        const wildcardSubdomainMenuId = await browser.menus.create({
            title: _("contextAddToWhitelistAdvancedAdd"
                  , patternWildcardSubdomain)
          , parentId: menuIdWhitelist
        });

        whitelistChildMenuPatterns.set(
                wildcardSubdomainMenuId, patternWildcardSubdomain);


        const wildcardProtocolAndSubdomainMenuId = await browser.menus.create({
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

        if (alteredOpts.includes("mirroringEnabled")) {
            browser.menus.update(menuIdMirroringCast, {
                visible: newOpts.mirroringEnabled
            });
        }

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

        if (!userAgentWhitelistEnabled) {
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

    console.info("fx_cast (Debug): init");

    isInitialized = true;


    await initMenus();
    await initRequestListener();
    await initWhitelist();

    await StatusManager.init();
    await ShimManager.init();


    await initBrowserAction();


    /**
     * When a message port connection with the name "shim" is
     * established, pass it to createShim to handle the setup
     * and maintenance.
     */
    browser.runtime.onConnect.addListener(async port => {
        if (port.name === "shim") {
            ShimManager.createShim(port);
        }
    });
}

init();
