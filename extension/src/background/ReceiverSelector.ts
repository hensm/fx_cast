import logger from "../lib/logger";
import messaging, { Port, Message } from "../messaging";
import options from "../lib/options";
import { TypedEventTarget } from "../lib/TypedEventTarget";

import type { SenderMediaMessage, SenderMessage } from "../cast/sdk/types";
import type {
    ReceiverDevice,
    ReceiverSelectorAppInfo,
    ReceiverSelectorMediaType,
    ReceiverSelectorPageInfo
} from "../types";

const POPUP_URL = browser.runtime.getURL("ui/popup/index.html");

export interface ReceiverSelection {
    device: ReceiverDevice;
    mediaType: ReceiverSelectorMediaType;
}

export interface ReceiverSelectorReceiverMessage {
    deviceId: string;
    message: SenderMessage;
}
export interface ReceiverSelectorMediaMessage {
    deviceId: string;
    message: SenderMediaMessage;
}

interface ReceiverSelectorEvents {
    selected: ReceiverSelection;
    cancelled: void;
    stop: { deviceId: string };
    error: string;
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

    private devices?: ReceiverDevice[];

    private defaultMediaType?: ReceiverSelectorMediaType;
    private availableMediaTypes?: ReceiverSelectorMediaType;

    private wasReceiverSelected = false;

    appInfo?: ReceiverSelectorAppInfo;
    pageInfo?: ReceiverSelectorPageInfo;

    constructor(private isBridgeCompatible: boolean) {
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
        devices: ReceiverDevice[];
        defaultMediaType: ReceiverSelectorMediaType;
        availableMediaTypes: ReceiverSelectorMediaType;
        appInfo?: ReceiverSelectorAppInfo;
        pageInfo?: ReceiverSelectorPageInfo;
    }) {
        this.appInfo = opts.appInfo;
        this.pageInfo = opts.pageInfo;

        // If popup already exists, close it
        if (this.windowId) {
            await browser.windows.remove(this.windowId);
        }

        this.devices = opts.devices;
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
        if (
            refWin.width !== undefined &&
            refWin.height !== undefined &&
            refWin.left !== undefined &&
            refWin.top !== undefined
        ) {
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
    public update(
        devices: ReceiverDevice[],
        isBridgeCompatible: boolean,
        connectedSessionIds: string[]
    ) {
        this.devices = devices;
        this.messagePort?.postMessage({
            subject: "popup:update",
            data: { devices, isBridgeCompatible, connectedSessionIds }
        });
    }

    /** Closes the receiver selector (if open). */
    public async close() {
        if (this.windowId) {
            await browser.windows.remove(this.windowId);
        }

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
            this.devices === undefined ||
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
            data: {
                appInfo: this.appInfo,
                pageInfo: this.pageInfo
            }
        });

        this.messagePort.postMessage({
            subject: "popup:update",
            data: {
                devices: this.devices,
                isBridgeCompatible: this.isBridgeCompatible,
                defaultMediaType: this.defaultMediaType,
                availableMediaTypes: this.availableMediaTypes
            }
        });
    }

    /** Handles messages from the popup extension page. */
    private onPopupMessage(message: Message) {
        switch (message.subject) {
            case "main:receiverSelected":
                this.wasReceiverSelected = true;
                this.dispatchEvent(
                    new CustomEvent("selected", { detail: message.data })
                );
                break;

            case "main:receiverStopped":
                this.dispatchEvent(
                    new CustomEvent("stop", { detail: message.data })
                );
                break;

            case "main:sendReceiverMessage":
                this.dispatchEvent(
                    new CustomEvent("receiverMessage", { detail: message.data })
                );
                break;
            case "main:sendMediaMessage":
                this.dispatchEvent(
                    new CustomEvent("mediaMessage", { detail: message.data })
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

        delete this.windowId;
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
