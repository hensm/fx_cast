"use strict";

import options from "../../lib/options";
import logger from "../../lib/logger";

import ShimManager from "../ShimManager";
import StatusManager from "../StatusManager";

import { getMediaTypesForPageUrl } from "../../lib/utils";

import { DEFAULT_MEDIA_RECEIVER_APP_ID } from "../../shim/cast/media/";

import { ReceiverSelector
       , ReceiverSelectorType } from "./";
import { ReceiverSelection
       , ReceiverSelectorMediaType } from "./ReceiverSelector";

import NativeReceiverSelector from "./NativeReceiverSelector";
import PopupReceiverSelector from "./PopupReceiverSelector";

import { Receiver } from "../../types";


async function createSelector () {
    const type = await options.get("receiverSelectorType");

    switch (type) {
        case ReceiverSelectorType.Native: {
            return new NativeReceiverSelector();
        }
        case ReceiverSelectorType.Popup: {
            return new PopupReceiverSelector();
        }
    }
}


let sharedSelector: ReceiverSelector;

async function getSelector () {
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
async function getSelection (
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
        if (currentShim?.requestedAppId ===
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

        sharedSelector.addEventListener("selected", onSelected);
        sharedSelector.addEventListener("cancelled", onCancelled);
        sharedSelector.addEventListener("error", onError);
        sharedSelector.addEventListener("stop", onStop);

        function removeListeners () {
            sharedSelector.removeEventListener("selected", onSelected);
            sharedSelector.removeEventListener("cancelled", onCancelled);
            sharedSelector.removeEventListener("error", onError);
            sharedSelector.removeEventListener("stop", onStop);
        }

        function onSelected (ev: any) {
            logger.info("Selected receiver", ev.detail);
            resolve(ev.detail);
            removeListeners();
        }

        function onCancelled () {
            logger.info("Cancelled receiver selection");
            resolve(null);
            removeListeners();
        }

        function onError () {
            logger.error("Failed to select receiver");
            reject();
            removeListeners();
        }

        function onStop (ev: any) {
            logger.info("Stopped receiver app", ev.detail);

            StatusManager.init().then(() => {
                StatusManager.stopReceiverApp(ev.detail.receiver);
            });
        }


        // Ensure status manager is initialized
        await StatusManager.init();

        sharedSelector.open(
                Array.from(StatusManager.getReceivers())
              , defaultMediaType
              , availableMediaTypes
              , currentShim?.requestedAppId ?? DEFAULT_MEDIA_RECEIVER_APP_ID);
    });
}

export default {
    getSelection
  , getSelector
};
