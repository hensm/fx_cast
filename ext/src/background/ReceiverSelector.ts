"use strict";

import logger from "../lib/logger";
import messaging, { Port, Message } from "../messaging";
import options from "../lib/options";
import { TypedEventTarget } from "../lib/TypedEventTarget";
import { getMediaTypesForPageUrl } from "../lib/utils";

import {
    ReceiverDevice,
    ReceiverSelectorMediaType,
    ReceiverSelectorPageInfo
} from "../types";

import deviceManager from "./deviceManager";
import castManager from "./castManager";

import { BaseConfig, baseConfigStorage, getAppTag } from "../cast/googleApi";
import type { SenderMediaMessage, SenderMessage } from "../cast/sdk/types";
import type { SessionRequest } from "../cast/sdk/classes";
import { ReceiverAction } from "../cast/sdk/enums";
import { createReceiver } from "../cast/utils";

const POPUP_URL = browser.runtime.getURL("ui/popup/index.html");

export interface ReceiverSelection {
    receiverDevice: ReceiverDevice;
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

let baseConfig: BaseConfig;

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

    pageInfo?: ReceiverSelectorPageInfo;

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

    static sharedInstance = new ReceiverSelector();

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
    static async getSelection(
        contextTabId: number,
        contextFrameId = 0,
        selectionOpts?: {
            sessionRequest?: SessionRequest;
            withMediaSender?: boolean;
        }
    ): Promise<ReceiverSelection | null> {
        let castInstance = castManager.getInstance(
            contextTabId,
            contextFrameId
        );
        /**
         * If the current context is running the mirroring app, pretend
         * it doesn't exist because it shouldn't be launched like this.
         */
        if (
            castInstance?.apiConfig?.sessionRequest.appId ===
            (await options.get("mirroringAppId"))
        ) {
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
                ReceiverSelectorMediaType.Tab | ReceiverSelectorMediaType.Screen
            );
        }

        // Remove file media type if local media is not enabled
        if (!opts.mediaEnabled || !opts.localMediaEnabled) {
            availableMediaTypes &= ~ReceiverSelectorMediaType.File;
        }

        // Ensure status manager is initialized
        await deviceManager.init();

        let isRequestAppAudioCompatible: Optional<boolean>;
        if (castInstance?.apiConfig?.sessionRequest.appId) {
            if (!baseConfig) {
                try {
                    baseConfig = (await baseConfigStorage.get("baseConfig"))
                        .baseConfig;
                } catch (err) {
                    throw logger.error("Failed to get Chromecast base config!");
                }
            }

            isRequestAppAudioCompatible = getAppTag(
                baseConfig,
                castInstance.apiConfig?.sessionRequest.appId
            )?.supports_audio_only;
        }

        return new Promise(async (resolve, reject) => {
            // Close an existing open selector
            if (ReceiverSelector.sharedInstance.isOpen) {
                await ReceiverSelector.sharedInstance.close();
            }

            const selector = createSelector();
            ReceiverSelector.sharedInstance = selector;

            // Handle selected return value
            const onSelected = (ev: CustomEvent<ReceiverSelection>) =>
                resolve(ev.detail);
            selector.addEventListener("selected", onSelected);

            // Handle cancelled return value
            const onCancelled = () => resolve(null);
            selector.addEventListener("cancelled", onCancelled);

            const onError = (ev: CustomEvent<string>) => reject(ev.detail);
            selector.addEventListener("error", onError);

            // Cleanup listeners
            selector.addEventListener(
                "close",
                () => {
                    selector.removeEventListener("selected", onSelected);
                    selector.removeEventListener("cancelled", onCancelled);
                    selector.removeEventListener("error", onError);
                },
                { once: true }
            );

            selector.open({
                receiverDevices: deviceManager.getDevices(),
                defaultMediaType,
                availableMediaTypes,
                appId: castInstance?.apiConfig?.sessionRequest.appId,
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

/**
 * Creates new ReceiverSelector object and adds listeners for
 * updates/messages.
 */
function createSelector() {
    // Get a new selector for each selection
    const selector = new ReceiverSelector();
    ReceiverSelector.sharedInstance = selector;

    /**
     * Sends message to cast instance to trigger stopped receiver action
     * (if applicable).
     */
    const onStop = (ev: CustomEvent<{ deviceId: string }>) => {
        const castInstance = castManager.getInstanceByDeviceId(
            ev.detail.deviceId
        );
        if (!castInstance) return;

        const device = deviceManager.getDeviceById(ev.detail.deviceId);
        if (!device) return;

        castInstance.contentPort.postMessage({
            subject: "cast:sendReceiverAction",
            data: {
                receiver: createReceiver(device),
                action: ReceiverAction.STOP
            }
        });
    };
    selector.addEventListener("stop", onStop);

    // Forward receiver messages
    const onReceiverMessage = (
        ev: CustomEvent<ReceiverSelectorReceiverMessage>
    ) =>
        deviceManager.sendReceiverMessage(
            ev.detail.deviceId,
            ev.detail.message
        );
    selector.addEventListener("receiverMessage", onReceiverMessage);

    // Forward media messages
    const onMediaMessage = (ev: CustomEvent<ReceiverSelectorMediaMessage>) =>
        deviceManager.sendMediaMessage(ev.detail.deviceId, ev.detail.message);
    selector.addEventListener("mediaMessage", onMediaMessage);

    // Update selector data whenever devices change/update
    const onDeviceChange = () => selector.update(deviceManager.getDevices());

    deviceManager.addEventListener("deviceUp", onDeviceChange);
    deviceManager.addEventListener("deviceDown", onDeviceChange);
    deviceManager.addEventListener("deviceUpdated", onDeviceChange);
    deviceManager.addEventListener("deviceMediaUpdated", onDeviceChange);

    // Cleanup listeners
    selector.addEventListener(
        "close",
        () => {
            deviceManager.removeEventListener("deviceUp", onDeviceChange);
            deviceManager.removeEventListener("deviceDown", onDeviceChange);
            deviceManager.removeEventListener("deviceUpdated", onDeviceChange);
            deviceManager.removeEventListener(
                "deviceMediaUpdated",
                onDeviceChange
            );

            selector.removeEventListener("stop", onStop);
            selector.removeEventListener("receiverMessage", onReceiverMessage);
            selector.removeEventListener("mediaMessage", onMediaMessage);
        },
        { once: true }
    );

    return selector;
}
