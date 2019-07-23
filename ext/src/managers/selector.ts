"use strict";

import { getReceiverSelector
       , ReceiverSelection
       , ReceiverSelector
       , ReceiverSelectorMediaType
       , ReceiverSelectorType } from "../receiver_selectors";

import StatusManager from "./status";


class SelectorManager {
    private sharedSelectors = new Map<ReceiverSelectorType, ReceiverSelector>();

    public async getSelectorType () {
        const { os } = await browser.runtime.getPlatformInfo();
        return os === "mac"
            ? ReceiverSelectorType.NativeMac
            : ReceiverSelectorType.Popup;
    }

    public async getSelector () {
        const type = await this.getSelectorType();
        return getReceiverSelector(type);
    }

    public async getSharedSelector () {
        const type = await this.getSelectorType();

        if (this.sharedSelectors.has(type)) {
            return this.sharedSelectors.get(type);
        }

        const selector = await this.getSelector();
        this.sharedSelectors.set(type, selector);

        return selector;
    }

    public async closeSharedSelector () {
        const sharedSelector = await this.getSharedSelector();

        if (sharedSelector.isOpen) {
            sharedSelector.close();
        }
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
    public getSelection (
            defaultMediaType =
                    ReceiverSelectorMediaType.Tab
          , availableMediaTypes =
                    ReceiverSelectorMediaType.Tab
                  | ReceiverSelectorMediaType.Screen
                  | ReceiverSelectorMediaType.File)
            : Promise<ReceiverSelection> {

        return new Promise(async (resolve, reject) => {
            /**
             * Close any existing selector, and renew to minimize issues
             * with bridge failing.
             */
            await this.closeSharedSelector();
            this.sharedSelectors.clear();

            const sharedSelector = await this.getSharedSelector();

            sharedSelector.addEventListener("selected", ev => {
                console.info("fx_cast (Debug): Selected receiver", ev.detail);
                resolve(ev.detail);

                this.sharedSelectors.clear();
            });

            sharedSelector.addEventListener("cancelled", () => {
                console.info("fx_cast (Debug): Cancelled receiver selection");
                resolve(null);

                this.sharedSelectors.clear();
            });

            sharedSelector.addEventListener("error", () => {
                console.error("fx_cast (Debug): Failed to select receiver");
                reject();

                this.sharedSelectors.clear();
            });

            sharedSelector.open(
                    Array.from(StatusManager.receivers.values())
                  , defaultMediaType
                  , availableMediaTypes);
        });
    }
}

export default new SelectorManager();
