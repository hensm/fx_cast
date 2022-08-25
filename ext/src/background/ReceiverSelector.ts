"use strict";

import logger from "../lib/logger";
import messaging, { Port, Message } from "../messaging";
import options from "../lib/options";
import { TypedEventTarget } from "../lib/TypedEventTarget";
import { getMediaTypesForPageUrl } from "../lib/utils";

import {
    ReceiverDevice,
    ReceiverSelectionActionType,
    ReceiverSelectorMediaType,
    ReceiverSelectorPageInfo
} from "../types";

import deviceManager from "./deviceManager";
import castManager from "./castManager";

import { BaseConfig, baseConfigStorage, getAppTag } from "../cast/googleApi";
import type { SessionRequest } from "../cast/sdk/classes";
import type { SenderMediaMessage, SenderMessage } from "../cast/sdk/types";

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

let baseConfig: BaseConfig;
baseConfigStorage
    .get("baseConfig")
    .then(value => {
        baseConfig = value.baseConfig;
    })
    .catch(() => {
        logger.error("Failed to get Chromecast base config!");
    });

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

    static shared = new ReceiverSelector();

    /**
     * Opens a receiver selector with the specified default/available media
     * types.
     *
     * Returns a promise that:
     *   - Resolves to a ReceiverSelection object if selection is
     *      successful.
     *   - Resolves to null if the selection is cancelled.
     *   - Rejects if the selection fails.
     */
    static getSelection(
        contextTabId: number,
        contextFrameId = 0,
        selectionOpts?: {
            sessionRequest?: SessionRequest;
            withMediaSender?: boolean;
        }
    ): Promise<ReceiverSelection | null> {
        return new Promise(async (resolve, reject) => {
            let castInstance = castManager.getInstance(
                contextTabId,
                contextFrameId
            );

            /**
             * If the current context is running the mirroring app, pretend
             * it doesn't exist because it shouldn't be launched like this.
             */
            if (castInstance?.appId === (await options.get("mirroringAppId"))) {
                castInstance = undefined;
            }

            let defaultMediaType = ReceiverSelectorMediaType.Tab;
            let availableMediaTypes = ReceiverSelectorMediaType.None;

            let pageUrl: string | undefined;
            try {
                pageUrl = (
                    await browser.webNavigation.getFrame({
                        tabId: contextTabId,
                        frameId: contextFrameId
                    })
                ).url;

                availableMediaTypes = getMediaTypesForPageUrl(pageUrl);
            } catch {
                logger.error(
                    "Failed to locate frame, falling back to default available media types."
                );
            }

            // Enable app media type if sender application is present
            if (castInstance || selectionOpts?.withMediaSender) {
                defaultMediaType = ReceiverSelectorMediaType.App;
                availableMediaTypes |= ReceiverSelectorMediaType.App;
            }

            const opts = await options.getAll();

            // Disable mirroring media types if mirroring is not enabled
            if (!opts.mirroringEnabled) {
                availableMediaTypes &= ~(
                    ReceiverSelectorMediaType.Tab |
                    ReceiverSelectorMediaType.Screen
                );
            }

            // Remove file media type if local media is not enabled
            if (!opts.mediaEnabled || !opts.localMediaEnabled) {
                availableMediaTypes &= ~ReceiverSelectorMediaType.File;
            }

            // Close an existing open selector
            if (ReceiverSelector.shared && ReceiverSelector.shared.isOpen) {
                ReceiverSelector.shared.close();
            }

            // Get a new selector for each selection
            ReceiverSelector.shared = new ReceiverSelector();

            function onReceiverChange() {
                ReceiverSelector.shared.update(deviceManager.getDevices());
            }

            deviceManager.addEventListener(
                "receiverDeviceUp",
                onReceiverChange
            );
            deviceManager.addEventListener(
                "receiverDeviceDown",
                onReceiverChange
            );
            deviceManager.addEventListener(
                "receiverDeviceUpdated",
                onReceiverChange
            );
            deviceManager.addEventListener(
                "receiverDeviceMediaUpdated",
                onReceiverChange
            );

            function onSelectorSelected(
                ev: CustomEvent<ReceiverSelectionCast>
            ) {
                logger.info("Selected receiver", ev.detail);

                resolve({
                    actionType: ReceiverSelectionActionType.Cast,
                    receiverDevice: ev.detail.receiverDevice,
                    mediaType: ev.detail.mediaType
                });
            }
            function onSelectorStop(ev: CustomEvent<ReceiverSelectionStop>) {
                logger.info("Stopping receiver app...", ev.detail);

                deviceManager.stopReceiverApp(ev.detail.receiverDevice.id);

                resolve({
                    actionType: ReceiverSelectionActionType.Stop,
                    receiverDevice: ev.detail.receiverDevice
                });
            }
            function onSelectorCancelled() {
                logger.info("Cancelled receiver selection");

                resolve(null);
            }
            function onSelectorError(ev: CustomEvent<string>) {
                reject(ev.detail);
            }
            function onReceiverMessage(
                ev: CustomEvent<ReceiverSelectorReceiverMessage>
            ) {
                deviceManager.sendReceiverMessage(
                    ev.detail.deviceId,
                    ev.detail.message
                );
            }
            function onMediaMessage(
                ev: CustomEvent<ReceiverSelectorMediaMessage>
            ) {
                deviceManager.sendMediaMessage(
                    ev.detail.deviceId,
                    ev.detail.message
                );
            }

            ReceiverSelector.shared.addEventListener(
                "selected",
                onSelectorSelected
            );
            ReceiverSelector.shared.addEventListener("stop", onSelectorStop);
            ReceiverSelector.shared.addEventListener(
                "cancelled",
                onSelectorCancelled
            );
            ReceiverSelector.shared.addEventListener("error", onSelectorError);
            ReceiverSelector.shared.addEventListener(
                "receiverMessage",
                onReceiverMessage
            );
            ReceiverSelector.shared.addEventListener(
                "mediaMessage",
                onMediaMessage
            );
            ReceiverSelector.shared.addEventListener("close", removeListeners);

            function removeListeners() {
                ReceiverSelector.shared.removeEventListener(
                    "selected",
                    onSelectorSelected
                );
                ReceiverSelector.shared.removeEventListener(
                    "stop",
                    onSelectorStop
                );
                ReceiverSelector.shared.removeEventListener(
                    "cancelled",
                    onSelectorCancelled
                );
                ReceiverSelector.shared.removeEventListener(
                    "error",
                    onSelectorError
                );
                ReceiverSelector.shared.removeEventListener(
                    "receiverMessage",
                    onReceiverMessage
                );
                ReceiverSelector.shared.removeEventListener(
                    "mediaMessage",
                    onMediaMessage
                );
                ReceiverSelector.shared.removeEventListener(
                    "close",
                    removeListeners
                );

                deviceManager.removeEventListener(
                    "receiverDeviceUp",
                    onReceiverChange
                );
                deviceManager.removeEventListener(
                    "receiverDeviceDown",
                    onReceiverChange
                );
                deviceManager.removeEventListener(
                    "receiverDeviceUpdated",
                    onReceiverChange
                );
                deviceManager.removeEventListener(
                    "receiverDeviceMediaUpdated",
                    onReceiverChange
                );
            }

            // Ensure status manager is initialized
            await deviceManager.init();

            let isRequestAppAudioCompatible: Optional<boolean>;
            if (castInstance?.appId) {
                const appTag = getAppTag(baseConfig, castInstance.appId);
                isRequestAppAudioCompatible = appTag?.supports_audio_only;
            }

            ReceiverSelector.shared.open({
                receiverDevices: deviceManager.getDevices(),
                defaultMediaType,
                availableMediaTypes,
                appId: castInstance?.appId,
                // Create page info
                pageInfo: pageUrl
                    ? {
                          url: pageUrl,
                          tabId: contextTabId,
                          frameId: contextFrameId,
                          sessionRequest: selectionOpts?.sessionRequest,
                          isRequestAppAudioCompatible
                      }
                    : undefined
            });
        });
    }
}
