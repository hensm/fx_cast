"use strict";

import options from "../lib/options";
import logger from "../lib/logger";

import { getMediaTypesForPageUrl } from "../lib/utils";
import { SessionRequest } from "../cast/sdk/classes";

import castManager from "./castManager";
import deviceManager from "./deviceManager";

import ReceiverSelector, {
    ReceiverSelection,
    ReceiverSelectionCast,
    ReceiverSelectionStop,
    ReceiverSelectorMediaMessage,
    ReceiverSelectorReceiverMessage
} from "./ReceiverSelector";

import {
    ReceiverSelectionActionType,
    ReceiverSelectorMediaType
} from "../types";

let sharedSelector: ReceiverSelector;
async function getSelector() {
    if (!sharedSelector) {
        try {
            sharedSelector = new ReceiverSelector();
        } catch (err) {
            throw logger.error("Failed to create receiver selector.");
        }
    }

    return sharedSelector;
}

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
async function getSelection(
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
                ReceiverSelectorMediaType.Tab | ReceiverSelectorMediaType.Screen
            );
        }

        // Remove file media type if local media is not enabled
        if (!opts.mediaEnabled || !opts.localMediaEnabled) {
            availableMediaTypes &= ~ReceiverSelectorMediaType.File;
        }

        // Close an existing open selector
        if (sharedSelector && sharedSelector.isOpen) {
            sharedSelector.close();
        }

        // Get a new selector for each selection
        sharedSelector = new ReceiverSelector();

        function onReceiverChange() {
            sharedSelector.update(deviceManager.getDevices());
        }

        deviceManager.addEventListener("receiverDeviceUp", onReceiverChange);
        deviceManager.addEventListener("receiverDeviceDown", onReceiverChange);
        deviceManager.addEventListener(
            "receiverDeviceUpdated",
            onReceiverChange
        );
        deviceManager.addEventListener(
            "receiverDeviceMediaUpdated",
            onReceiverChange
        );

        function onSelectorSelected(ev: CustomEvent<ReceiverSelectionCast>) {
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
        function onMediaMessage(ev: CustomEvent<ReceiverSelectorMediaMessage>) {
            deviceManager.sendMediaMessage(
                ev.detail.deviceId,
                ev.detail.message
            );
        }

        sharedSelector.addEventListener("selected", onSelectorSelected);
        sharedSelector.addEventListener("stop", onSelectorStop);
        sharedSelector.addEventListener("cancelled", onSelectorCancelled);
        sharedSelector.addEventListener("error", onSelectorError);
        sharedSelector.addEventListener("receiverMessage", onReceiverMessage);
        sharedSelector.addEventListener("mediaMessage", onMediaMessage);
        sharedSelector.addEventListener("close", removeListeners);

        function removeListeners() {
            sharedSelector.removeEventListener("selected", onSelectorSelected);
            sharedSelector.removeEventListener("stop", onSelectorStop);
            sharedSelector.removeEventListener(
                "cancelled",
                onSelectorCancelled
            );
            sharedSelector.removeEventListener("error", onSelectorError);
            sharedSelector.removeEventListener(
                "receiverMessage",
                onReceiverMessage
            );
            sharedSelector.removeEventListener("mediaMessage", onMediaMessage);
            sharedSelector.removeEventListener("close", removeListeners);

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

        sharedSelector.open({
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
                      sessionRequest: selectionOpts?.sessionRequest
                  }
                : undefined
        });
    });
}

export default {
    getSelection,
    getSelector
};
