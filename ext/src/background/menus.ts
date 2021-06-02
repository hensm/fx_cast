"use strict";

import loadSender from "../lib/loadSender";
import logger from "../lib/logger";
import options from "../lib/options";

import { stringify } from "../lib/utils";

import { ReceiverSelectionActionType
       , ReceiverSelectorMediaType } from "./receiverSelector";

import ReceiverSelectorManager
        from "./receiverSelector/ReceiverSelectorManager";

const _ = browser.i18n.getMessage;


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

export async function initMenus() {
    logger.info("init (menus)");

    const opts = await options.getAll();

    // Global "Cast..." menu item
    menuIdCast = browser.menus.create({
        contexts: [ "browser_action", "page", "tools_menu" ]
      , title: _("contextCast")
    });

    // <video>/<audio> "Cast..." context menu item
    menuIdMediaCast = browser.menus.create({
        contexts: [ "audio", "video", "image" ]
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
}


browser.menus.onClicked.addListener(async (info, tab) => {
    if (info.parentMenuItemId === menuIdWhitelist) {
        const pattern = whitelistChildMenuPatterns.get(info.menuItemId);
        if (!pattern) {
            throw logger.error(`Whitelist pattern not found for menu item ID ${info.menuItemId}.`);
        }

        const whitelist = await options.get("userAgentWhitelist");
        if (!whitelist.includes(pattern)) {
            // Add to whitelist and update options
            whitelist.push(pattern);
            await options.set("userAgentWhitelist", whitelist);
        }

        return;
    }

    if (tab?.id === undefined) {
        throw logger.error("Menu handler tab ID not found.");
    }
    if (!info.pageUrl) {
        throw logger.error("Menu handler page URL not found.");
    }

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
                            file: "senders/media/index.js"
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
    const baseDomain = (url.hostname.match(/\./g) || []).length > 1
        ? url.hostname.substring(url.hostname.indexOf(".") + 1)
        : url.hostname;

    const portlessOrigin = `${url.protocol}//${url.hostname}`;

    const patternRecommended = `${portlessOrigin}/*`;
    const patternSearch = `${portlessOrigin}${url.pathname}${url.search}`;
    const patternWildcardProtocol = `*://${url.hostname}/*`;
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

                const pattern = `${portlessOrigin}/${partialPath}/*`;

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

    if (menuIdMediaCast && alteredOpts.includes("mediaEnabled")) {
        browser.menus.update(menuIdMediaCast, {
            visible: newOpts.mediaEnabled
        });
    }

    if (menuIdMediaCast && alteredOpts.includes("localMediaEnabled")) {
        browser.menus.update(menuIdMediaCast, {
            targetUrlPatterns: newOpts.localMediaEnabled
                ? URL_PATTERNS_ALL
                : URL_PATTERNS_REMOTE
        });
    }
});
