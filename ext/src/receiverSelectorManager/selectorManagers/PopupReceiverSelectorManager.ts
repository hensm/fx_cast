"use strict";

import ReceiverSelectorManager, {
        ReceiverSelectorMediaType } from "../ReceiverSelectorManager";

import { getWindowCenteredProps } from "../../lib/utils";
import { Message, Receiver } from "../../types";


class PopupReceiverSelectorManager
        extends EventTarget
        implements ReceiverSelectorManager {

    private windowId: number;
    private openerWindowId: number;
    private messagePort: browser.runtime.Port;

    private receivers: Receiver[];
    private defaultMediaType: ReceiverSelectorMediaType;

    private wasReceiverSelected: boolean = false;


    constructor () {
        super();

        // Bind methods to pass to addListener
        this.onPopupMessage = this.onPopupMessage.bind(this);
        this.onWindowsRemoved = this.onWindowsRemoved.bind(this);
        this.onWindowsFocusChanged = this.onWindowsFocusChanged.bind(this);

        browser.windows.onRemoved.addListener(this.onWindowsRemoved);

        /**
         * Handle incoming message channel connection from popup
         * window script.
         */
        browser.runtime.onConnect.addListener(port => {
            if (port.name !== "popup") {
                return;
            }

            // Disconnect existing port
            if (this.messagePort) {
                this.messagePort.disconnect();
            }

            this.messagePort = port;
            this.messagePort.onMessage.addListener(this.onPopupMessage);

            // TODO: Send initial data
        });
    }


    public async open (
            receivers: Receiver[]
          , defaultMediaType: ReceiverSelectorMediaType): Promise<void> {

        // If popup already exists, close it
        if (this.windowId) {
            await browser.windows.remove(this.windowId);
        }

        this.receivers = receivers;
        this.defaultMediaType = defaultMediaType;

        // Current window to base centered position on
        const openerWindow = await browser.windows.getCurrent();
        const centeredProps = getWindowCenteredProps(openerWindow, 350, 200);

        const popup = await browser.windows.create({
            url: "ui/popup/index.html"
          , type: "popup"
          , ...centeredProps
        });

        this.windowId = popup.id;
        this.openerWindowId = openerWindow.id;

        // Size/position not set correctly on creation (bug?)
        await browser.windows.update(this.windowId, {
            ...centeredProps
        });

        // Add focus listener
        browser.windows.onFocusChanged.addListener(
                this.onWindowsFocusChanged);
    }

    public close (): void {
        browser.windows.remove(this.windowId);
    }


    /**
     * Handles popup messages.
     */
    private onPopupMessage (message: Message) {
        switch (message.subject) {
            case "selected": {
                break;
            }
        }
    }

    /**
     * Handles cancellation state where the popup window is closed
     * before a receiver is selected.
     */
    private onWindowsRemoved (windowId: number) {
        // Only care about popup window
        if (windowId !== this.windowId) {
            return;
        }

        browser.windows.onFocusChanged.removeListener(
                this.onWindowsFocusChanged);

        if (!this.wasReceiverSelected) {
            this.dispatchEvent(new CustomEvent("cancelled"));
        }

        // Cleanup
        this.windowId = null;
        this.openerWindowId = null;
        this.messagePort = null;
        this.receivers = null;
        this.defaultMediaType = null;
        this.wasReceiverSelected = false;
    }

    /**
     * Closes popup window if another browser window is brought
     * into focus. Doesn't apply if no window is focused
     * `WINDOW_ID_NONE` or if the popup window is re-focused.
     */
    private onWindowsFocusChanged (windowId: number) {
        if (windowId !== browser.windows.WINDOW_ID_NONE
                && windowId !== this.windowId) {

            // Only run once
            browser.windows.onFocusChanged.removeListener(
                    this.onWindowsFocusChanged);

            browser.windows.remove(this.windowId);
        }
    }
}

// Singleton instance
export default new PopupReceiverSelectorManager();
