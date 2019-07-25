"use strict";

import options from "./lib/options";

import { getReceiverSelector
       , ReceiverSelection
       , ReceiverSelector
       , ReceiverSelectorMediaType
       , ReceiverSelectorType } from "./receiver_selectors";

import StatusManager from "./StatusManager";


let sharedSelector: ReceiverSelector;

async function getSelector () {
    return getReceiverSelector(
            await options.get("receiverSelectorType"));
}

async function getSharedSelector () {
    if (!sharedSelector) {
        sharedSelector = await getSelector();
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
              | ReceiverSelectorMediaType.Screen)
              // | ReceiverSelectorMediaType.File)
        : Promise<ReceiverSelection> {

    return new Promise(async (resolve, reject) => {
        /**
         * Close any existing selector, and renew to minimize issues
         * with bridge failing.
         */
        await getSharedSelector();
        if (sharedSelector.isOpen) {
            sharedSelector.close();
        }

        sharedSelector = await getSelector();

        sharedSelector.addEventListener("selected", ev => {
            console.info("fx_cast (Debug): Selected receiver", ev.detail);
            resolve(ev.detail);
        });

        sharedSelector.addEventListener("cancelled", ev => {
            console.info("fx_cast (Debug): Cancelled receiver selection");
            resolve(null);
        });

        sharedSelector.addEventListener("error", ev => {
            console.error("fx_cast (Debug): Failed to select receiver");
            reject();
        });

        sharedSelector.open(
                StatusManager.getReceivers()
              , defaultMediaType
              , availableMediaTypes);
    });
}

export default {
    getSelection
  , getSharedSelector
};
