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

    browser.browserAction.setTitle({ tabId, title });
    browser.browserAction.setIcon({ tabId, path });
}

export function initAction() {
    logger.info("init (action)");

    updateActionState(ActionState.Default);

    browser.browserAction.onClicked.addListener(async tab => {
        if (tab.id === undefined) {
            logger.error("Tab ID not found in browser action handler.");
            return;
        }

        castManager.triggerCast(tab.id);
    });
}
