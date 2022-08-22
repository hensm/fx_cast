"use strict";

import logger from "../lib/logger";
import messaging, { Port, Message } from "../messaging";
import options from "../lib/options";

import { TypedEventTarget } from "../lib/TypedEventTarget";
import { SenderMediaMessage, SenderMessage } from "../cast/sdk/types";
import {
    ReceiverDevice,
    ReceiverSelectionActionType,
    ReceiverSelectorMediaType,
    ReceiverSelectorPageInfo
} from "../types";

const POPUP_URL = browser.runtime.getURL("ui/popup/index.html");

export interface ReceiverSelectionCast {
    actionType: ReceiverSelectionActionType.Cast;
    receiverDevice: ReceiverDevice;
    mediaType: ReceiverSelectorMediaType;
}
export interface ReceiverSelectionStop {
    actionType: ReceiverSelectionActionType.Stop;
    receiverDevice: ReceiverDevice;
}
export type ReceiverSelection = ReceiverSelectionCast | ReceiverSelectionStop;

export interface ReceiverSelectorReceiverMessage {
    deviceId: string;
    message: SenderMessage;
}
export interface ReceiverSelectorMediaMessage {
    deviceId: string;
    message: SenderMediaMessage;
}

interface ReceiverSelectorEvents {
    selected: ReceiverSelectionCast;
    error: string;
    cancelled: void;
    stop: ReceiverSelectionStop;
    close: void;
    receiverMessage: ReceiverSelectorReceiverMessage;
    mediaMessage: ReceiverSelectorMediaMessage;
}

/**
 * Manages the receiver selector popup window and communication with the
 * extension page hosted within.
 */
export default class ReceiverSelector extends TypedEventTarget<ReceiverSelectorEvents> {
    /** Popup window ID. */
    private windowId?: number;

    /** Message port to extension page. */
    private messagePort?: Port;
    private messagePortDisconnected?: boolean;

    private receiverDevices?: ReceiverDevice[];

    private defaultMediaType?: ReceiverSelectorMediaType;
    private availableMediaTypes?: ReceiverSelectorMediaType;

    private wasReceiverSelected = false;

    private appId?: string;
    private pageInfo?: ReceiverSelectorPageInfo;

    constructor() {
        super();

        this.onConnect = this.onConnect.bind(this);
        this.onPopupMessage = this.onPopupMessage.bind(this);
        this.onWindowsRemoved = this.onWindowsRemoved.bind(this);
        this.onWindowsFocusChanged = this.onWindowsFocusChanged.bind(this);

        browser.windows.onRemoved.addListener(this.onWindowsRemoved);
        browser.windows.onFocusChanged.addListener(this.onWindowsFocusChanged);

        /**
         * Handle incoming message channel connection from popup
         * window script.
         */
        messaging.onConnect.addListener(this.onConnect);
    }

    /** Is receiver selector window currently open. */
    get isOpen() {
        return this.windowId !== undefined;
    }

    /**
     * Creates and opens a receiver selector window.
     */
    public async open(opts: {
        receiverDevices: ReceiverDevice[];
        defaultMediaType: ReceiverSelectorMediaType;
        availableMediaTypes: ReceiverSelectorMediaType;
        appId?: string;
        pageInfo?: ReceiverSelectorPageInfo;
    }) {
        this.appId = opts.appId;
        this.pageInfo = opts.pageInfo;

        // If popup already exists, close it
        if (this.windowId) {
            await browser.windows.remove(this.windowId);
        }

        this.receiverDevices = opts.receiverDevices;
        this.defaultMediaType = opts.defaultMediaType;
        this.availableMediaTypes = opts.availableMediaTypes;

        const popupSizePosition = {
            width: 400,
            height: 200,
            left: 100,
            top: 100
        };

        /**
         * Get current browser window and calculate relative centered
         * left/top positions for the popup.
         */
        const refWin = await browser.windows.getCurrent();
        if (refWin.width && refWin.height && refWin.left && refWin.top) {
            const centerX = refWin.left + refWin.width / 2;
            const centerY = refWin.top + refWin.height / 3;

            popupSizePosition.left = Math.floor(
                centerX - popupSizePosition.width / 2
            );
            popupSizePosition.top = Math.floor(
                centerY - popupSizePosition.height / 2
            );
        } else {
            logger.log("Reference window missing positional properties.");
        }

        // Create popup window
        const popup = await browser.windows.create({
            url: POPUP_URL,
            type: "popup",
            ...popupSizePosition
        });
        if (popup?.id === undefined) {
            throw logger.error("Failed to create receiver selector popup.");
        }

        // Size/position not set correctly on creation (bug 1396881)
        await browser.windows.update(popup.id, {
            ...popupSizePosition
        });

        this.windowId = popup.id;
    }

    /** Updates receiver devices displayed in the receiver selector. */
    public update(receiverDevices: ReceiverDevice[]) {
        this.receiverDevices = receiverDevices;
        this.messagePort?.postMessage({
            subject: "popup:update",
            data: {
                receiverDevices: this.receiverDevices
            }
        });
    }

    /** Closes the receiver selector (if open). */
    public async close() {
        if (this.windowId) {
            await browser.windows.remove(this.windowId);
        }

        this.appId = undefined;

        if (this.messagePort && !this.messagePortDisconnected) {
            this.messagePort.disconnect();
        }
    }

    /**
     * Handles incoming port connection from the extension page and
     * sends init data.
     */
    private onConnect(port: Port) {
        // Keep history state clean
        browser.history.deleteUrl({ url: POPUP_URL });

        if (port.name !== "popup") {
            return;
        }

        this.messagePort?.disconnect();

        this.messagePort = port;
        this.messagePort.onMessage.addListener(this.onPopupMessage);
        this.messagePort.onDisconnect.addListener(() => {
            this.messagePortDisconnected = true;
        });

        if (
            this.receiverDevices === undefined ||
            this.defaultMediaType === undefined ||
            this.availableMediaTypes === undefined
        ) {
            this.dispatchEvent(
                new CustomEvent("error", {
                    detail: "Popup receiver data not found."
                })
            );
            return;
        }

        this.messagePort.postMessage({
            subject: "popup:init",
            data: { appId: this.appId, pageInfo: this.pageInfo }
        });

        this.messagePort.postMessage({
            subject: "popup:update",
            data: {
                receiverDevices: this.receiverDevices,
                defaultMediaType: this.defaultMediaType,
                availableMediaTypes: this.availableMediaTypes
            }
        });
    }

    /** Handles messages from the popup extension page. */
    private onPopupMessage(message: Message) {
        switch (message.subject) {
            case "receiverSelector:selected": {
                this.wasReceiverSelected = true;
                this.dispatchEvent(
                    new CustomEvent("selected", {
                        detail: message.data
                    })
                );

                break;
            }

            case "receiverSelector:stop": {
                this.dispatchEvent(
                    new CustomEvent("stop", {
                        detail: message.data
                    })
                );

                break;
            }

            case "receiverSelector:receiverMessage":
                this.dispatchEvent(
                    new CustomEvent("receiverMessage", {
                        detail: message.data
                    })
                );
                break;
            case "receiverSelector:mediaMessage":
                this.dispatchEvent(
                    new CustomEvent("mediaMessage", {
                        detail: message.data
                    })
                );
                break;
        }
    }

    /**
     * Handles cancellation state where the popup window is closed
     * before a receiver is selected.
     */
    private onWindowsRemoved(windowId: number) {
        // Only care about popup window
        if (windowId !== this.windowId) {
            return;
        }

        browser.windows.onRemoved.removeListener(this.onWindowsRemoved);
        browser.windows.onFocusChanged.removeListener(
            this.onWindowsFocusChanged
        );

        if (!this.wasReceiverSelected) {
            this.dispatchEvent(new CustomEvent("cancelled"));
        }

        this.dispatchEvent(new CustomEvent("close"));

        // Cleanup
        delete this.windowId;
        delete this.messagePort;
        delete this.receiverDevices;
        delete this.defaultMediaType;
        delete this.availableMediaTypes;
        this.wasReceiverSelected = false;
    }

    /**
     * Closes popup window if another browser window is brought into
     * focus. Doesn't apply if no window is focused `WINDOW_ID_NONE`
     * or if the popup window is re-focused.
     */
    private async onWindowsFocusChanged(windowId: number) {
        if (!this.windowId) return;

        if (
            windowId !== browser.windows.WINDOW_ID_NONE &&
            windowId !== this.windowId
        ) {
            if (await options.get("receiverSelectorCloseIfFocusLost")) {
                browser.windows.remove(this.windowId);
            }
        }
    }
}
