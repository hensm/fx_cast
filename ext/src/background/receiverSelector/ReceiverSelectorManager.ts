"use strict";

import options from "../../lib/options";

import StatusManager from "../StatusManager";

import { ReceiverSelector
       , ReceiverSelectorType } from "./";
import { ReceiverSelection
       , ReceiverSelectorMediaType } from "./ReceiverSelector";

import NativeReceiverSelector from "./NativeReceiverSelector";
import PopupReceiverSelector from "./PopupReceiverSelector";


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
        sharedSelector = await createSelector();
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
        defaultMediaType =
                ReceiverSelectorMediaType.Tab
      , availableMediaTypes =
                ReceiverSelectorMediaType.Tab
              | ReceiverSelectorMediaType.Screen
              | ReceiverSelectorMediaType.File
      , requestedAppId: string)
        : Promise<ReceiverSelection> {

    return new Promise(async (resolve, reject) => {

        // Close an existing open selector
        if (sharedSelector && sharedSelector.isOpen) {
            sharedSelector.close();
        }

        // Get a new selector for each selection
        sharedSelector = await createSelector();

        sharedSelector.addEventListener("selected", ev => {
            console.info("fx_cast (Debug): Selected receiver", ev.detail);
            resolve(ev.detail);
        });

        sharedSelector.addEventListener("cancelled", () => {
            console.info("fx_cast (Debug): Cancelled receiver selection");
            resolve(null);
        });

        sharedSelector.addEventListener("error", () => {
            console.error("fx_cast (Debug): Failed to select receiver");
            reject();
        });


        const opts = await options.getAll();

        // Remove mirroring media types if mirroring is not enabled.
        if (!opts.mirroringEnabled) {
            availableMediaTypes &= ~(
                    ReceiverSelectorMediaType.Tab
                  | ReceiverSelectorMediaType.Screen);
        }

        // Remove file media type if local media is not enabled
        if (!opts.mediaEnabled || !opts.localMediaEnabled) {
            availableMediaTypes &= ~ReceiverSelectorMediaType.File;
        }


        // Ensure status manager is initialized
        await StatusManager.init();

        sharedSelector.open(
                Array.from(StatusManager.getReceivers())
              , defaultMediaType
              , availableMediaTypes
              , requestedAppId);
    });
}

export default {
    getSelection
  , getSelector
};
