import logger from "../lib/logger";
import castManager from "./castManager";

const _ = browser.i18n.getMessage;

const ACTION_ICON_DEFAULT_DARK = "icons/cast-default-dark.svg";
const ACTION_ICON_DEFAULT_LIGHT = "icons/cast-default-light.svg";
const ACTION_ICON_CONNECTING_DARK = "icons/cast-connecting-dark.svg";
const ACTION_ICON_CONNECTING_LIGHT = "icons/cast-connecting-light.svg";
const ACTION_ICON_CONNECTED = "icons/cast-connected.svg";

const isDarkTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;

export enum ActionState {
    Default,
    Connecting,
    Connected
}

/** Updates action details depending on given state. */
export function updateActionState(state: ActionState, tabId?: number) {
    let title: string;
    let path = isDarkTheme
        ? ACTION_ICON_DEFAULT_LIGHT
        : ACTION_ICON_DEFAULT_DARK;

    switch (state) {
        case ActionState.Default:
            title = _("actionTitleDefault");
            break;
        case ActionState.Connecting:
            title = _("actionTitleConnecting");
            path = isDarkTheme
                ? ACTION_ICON_CONNECTING_LIGHT
                : ACTION_ICON_CONNECTING_DARK;
            break;
        case ActionState.Connected:
            title = _("actionTitleConnected");
            path = ACTION_ICON_CONNECTED;
            break;
    }

    browser.action.setTitle({ tabId, title });
    browser.action.setIcon({ tabId, path });
}

export function initAction() {
    logger.info("init (action)");

    updateActionState(ActionState.Default);

    browser.action.onClicked.addListener(async tab => {
        if (tab.id === undefined) {
            logger.error("Tab ID not found in browser action handler.");
            return;
        }

        castManager.triggerCast(tab.id);
    });

    // --- FEATURE C: WEBSITE CAST DETECTOR ---
    
    // Set the notification badge color to a nice Netflix Red
    browser.action.setBadgeBackgroundColor({ color: "#e50914" });

    // Helper function to scan a tab for video elements
    async function scanTabForMedia(tabId: number, url?: string) {
        // Ignore internal browser pages and empty tabs
        if (!url || !url.startsWith("http")) {
            browser.action.setBadgeText({ tabId, text: "" });
            return;
        }

        try {
            const results = await browser.scripting.executeScript({
                target: { tabId },
                func: () => {
                    const videos = document.querySelectorAll("video");
                    let validVideos = 0;
                    videos.forEach(vid => {
                        // Filter out tiny hidden videos (often used for background tracking)
                        if (vid.offsetWidth > 50 && vid.offsetHeight > 50) validVideos++;
                    });
                    return validVideos;
                }
            });

            const videoCount = results[0]?.result;
            if (videoCount && videoCount > 0) {
                // Show the number of videos found on the badge!
                browser.action.setBadgeText({ tabId, text: videoCount.toString() });
            } else {
                browser.action.setBadgeText({ tabId, text: "" });
            }
        } catch (err) {
            // Silently ignore errors on restricted Firefox pages (like AMO)
        }
    }

    // Trigger the scan when a page finishes loading
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === "complete") {
            scanTabForMedia(tabId, tab.url);
        }
    });

    // Trigger the scan when you switch between tabs
    browser.tabs.onActivated.addListener(async (activeInfo) => {
        try {
            const tab = await browser.tabs.get(activeInfo.tabId);
            scanTabForMedia(activeInfo.tabId, tab.url);
        } catch (err) {}
    });
}
