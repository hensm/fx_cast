"use strict";

import options from "../../lib/options";
import logger from "../../lib/logger";

import ShimManager from "../ShimManager";
import StatusManager from "../StatusManager";

import { getMediaTypesForPageUrl } from "../../lib/utils";

import { ReceiverSelector
       , ReceiverSelectorType } from "./";
import { ReceiverSelection
       , ReceiverSelectionActionType
       , ReceiverSelectorMediaType } from "./ReceiverSelector";

import NativeReceiverSelector from "./NativeReceiverSelector";
import PopupReceiverSelector from "./PopupReceiverSelector";


async function createSelector() {
    const type = await options.get("receiverSelectorType");
    const platformInfo = await browser.runtime.getPlatformInfo();

    if (platformInfo.os === "mac"
            && type === ReceiverSelectorType.Native) {
        return new NativeReceiverSelector();
    }

    return new PopupReceiverSelector();
}


let sharedSelector: ReceiverSelector;

async function getSelector() {
    if (!sharedSelector) {
        try {
            sharedSelector = await createSelector();
        } catch (err) {
            throw logger.error("Failed to create receiver selector.");
        }
    }

    return sharedSelector;
}


/**
 * Opens a receiver selector with the specified
 * default/available media types.
 *
 * Returns a promise that:
 *   - Resolves to a ReceiverSelection object if selection is
 *      successful.
 *   - Resolves to null if the selection is cancelled.
 *   - Rejects if the selection fails.
 */
async function getSelection(
        contextTabId: number
      , contextFrameId = 0
      , withMediaSender = false)
        : Promise<ReceiverSelection | null> {

    return new Promise(async (resolve, reject) => {
        let currentShim = ShimManager.getShim(
                contextTabId, contextFrameId);

        /**
         * If the current context is running the mirroring app, pretend
         * it doesn't exist because it shouldn't be launched like this.
         */
        if (currentShim?.appId ===
                await options.get("mirroringAppId")) {
            currentShim = undefined;
        }

        let defaultMediaType = ReceiverSelectorMediaType.Tab;
        let availableMediaTypes;

        try {
            const { url } = await browser.webNavigation.getFrame({
                tabId: contextTabId
              , frameId: contextFrameId
            });

            availableMediaTypes = getMediaTypesForPageUrl(url);
        } catch {
            logger.error("Failed to locate frame, falling back to default available media types.");
            availableMediaTypes = ReceiverSelectorMediaType.File;
        }

        // Enable app media type if initialized sender app is found
        if (currentShim || withMediaSender) {
            defaultMediaType = ReceiverSelectorMediaType.App;
            availableMediaTypes |= ReceiverSelectorMediaType.App;
        }

        const opts = await options.getAll();

        // Remove mirroring media types if mirroring is not enabled
        if (!opts.mirroringEnabled) {
            availableMediaTypes &= ~(
                    ReceiverSelectorMediaType.Tab
                  | ReceiverSelectorMediaType.Screen);
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
        sharedSelector = await createSelector();


        function onReceiverChange() {
            sharedSelector.update(Array.from(StatusManager.getReceivers()));
        }

        StatusManager.addEventListener("serviceUp", onReceiverChange);
        StatusManager.addEventListener("serviceDown", onReceiverChange);
        StatusManager.addEventListener("statusUpdate", onReceiverChange);


        let onSelected: any;
        let onCancelled: any;
        let onError: any;
        let onStop: any;

        type EvParamsType =
                Parameters<typeof sharedSelector.addEventListener>[0];

        function storeListener<T>(type: EvParamsType, fn: T) {
            if (type === "selected") {
                onSelected = fn;
            } else if (type === "cancelled") {
                onCancelled = fn;
            } else if (type === "error") {
                onError = fn;
            } else if (type === "stop") {
                onStop = fn;
            }

            return fn;
        }

        function removeListeners() {
            sharedSelector.removeEventListener("selected", onSelected);
            sharedSelector.removeEventListener("cancelled", onCancelled);
            sharedSelector.removeEventListener("error", onError);
            sharedSelector.removeEventListener("stop", onStop);

            StatusManager.removeEventListener("serviceUp", onReceiverChange);
            StatusManager.removeEventListener("serviceDown", onReceiverChange);
            StatusManager.removeEventListener("statusUpdate", onReceiverChange);
        }

        sharedSelector.addEventListener("selected"
              , storeListener("selected", ev => {

            logger.info("Selected receiver", ev.detail);
            resolve({
                actionType: ReceiverSelectionActionType.Cast
              , receiver: ev.detail.receiver
              , mediaType: ev.detail.mediaType
              , filePath: ev.detail.filePath
            });
            removeListeners();
        }));

        sharedSelector.addEventListener("cancelled"
              , storeListener("cancelled", () => {

            logger.info("Cancelled receiver selection");
            resolve(null);
            removeListeners();
        }));

        sharedSelector.addEventListener("error"
              , storeListener("error", () => {
            reject();
            removeListeners();
        }));

        sharedSelector.addEventListener("stop"
              , storeListener("stop", async ev => {

            logger.info("Stopped receiver app", ev.detail);

            await StatusManager.init();
            await StatusManager.stopReceiverApp(ev.detail.receiver);

            resolve({
                actionType: ReceiverSelectionActionType.Stop
              , receiver: ev.detail.receiver
            });
            removeListeners();
        }));


        // Ensure status manager is initialized
        await StatusManager.init();

        sharedSelector.open(
                Array.from(StatusManager.getReceivers())
              , defaultMediaType
              , availableMediaTypes
              , currentShim?.appId);
    });
}

export default {
    getSelection
  , getSelector
};
