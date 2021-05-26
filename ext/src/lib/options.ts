"use strict";

import defaultOptions from "../defaultOptions";

import logger from "./logger";

import { ReceiverSelectorType } from "../background/receiverSelector";
import { TypedEventTarget } from "./TypedEventTarget";
import { TypedStorageArea } from "./TypedStorageArea";


const storageArea = new TypedStorageArea<{
    options: Options
}>(browser.storage.sync);

export interface Options {
    bridgeApplicationName: string;
    bridgeBackupEnabled: boolean;
    bridgeBackupHost: string;
    bridgeBackupPort: number;
    mediaEnabled: boolean;
    mediaOverlayEnabled: boolean;
    mediaSyncElement: boolean;
    mediaStopOnUnload: boolean;
    localMediaEnabled: boolean;
    localMediaServerPort: number;
    mirroringEnabled: boolean;
    mirroringAppId: string;
    receiverSelectorCloseIfFocusLost: boolean;
    receiverSelectorWaitForConnection: boolean;
    userAgentWhitelistEnabled: boolean;
    userAgentWhitelistRestrictedEnabled: boolean;
    userAgentWhitelist: string[];

    [key: string]: Options[keyof Options];
}


interface EventMap {
    "changed": Array<keyof Options>;
}

export default new class extends TypedEventTarget<EventMap> {
    constructor() {
        super();
        this.onStorageChanged = this.onStorageChanged.bind(this);
        browser.storage.onChanged.addListener(this.onStorageChanged);

        // Supresses sendRemoveListener closed conduit error
        window.addEventListener("unload", () => {
            browser.storage.onChanged.removeListener(this.onStorageChanged);
        });
    }

    private onStorageChanged(
            changes: { [key: string]: browser.storage.StorageChange }
          , areaName: string) {

        if (areaName !== "sync") {
            return;
        }

        if ("options" in changes) {
            const { oldValue, newValue } = changes.options;
            const changedKeys = [];

            for (const key of Object.keys(newValue)) {
                if (oldValue) {
                    // Don't track added keys
                    if (!(key in oldValue)) {
                        continue;
                    }

                    const oldKeyValue = oldValue[key];
                    const newKeyValue = newValue[key];

                    // Equality comparison
                    if (oldKeyValue === newKeyValue) {
                        continue;
                    }

                    // Array comparison
                    if (oldKeyValue instanceof Array
                        && newKeyValue instanceof Array) {
                        if (oldKeyValue.length === newKeyValue.length
                            && oldKeyValue.every((value, index) =>
                                value === newKeyValue[index])) {
                            continue;
                        }
                    }
                }

                changedKeys.push(key);
            }

            this.dispatchEvent(new CustomEvent("changed", {
                detail: changedKeys as Array<keyof Options>
            }));
        }
    }

    /**
     * Fetches `options` key from storage and returns it as
     * Options interface type.
     */
    public async getAll(): Promise<Options> {
        const { options } = await storageArea.get("options");
        return options;
    }

    /**
     * Takes Options object and sets to `options` storage key.
     * Returns storage promise.
     */
    public async setAll(options: Options): Promise<void> {
        return storageArea.set({ options });
    }

    /**
     * Gets specific option from storage and returns it as its
     * type from Options interface type.
     */
    public async get<T extends keyof Options>(name: T): Promise<Options[T]> {
        const options = await this.getAll();

        if (options.hasOwnProperty(name)) {
            return options[name];
        } else {
            throw logger.error(`Failed to find option ${name} in storage.`);
        }
    }

    /**
     * Sets specific option to storage. Returns storage
     * promise.
     */
    public async set<T extends keyof Options>(
            name: T
          , value: Options[T]): Promise<void> {

        const options = await this.getAll();
        options[name] = value;
        return this.setAll(options);
    }


    /**
     * Gets existing options from storage and compares it
     * against defaults. Any options in defaults and not in
     * storage are set. Does not override any existing options.
     */
    public async update(defaults = defaultOptions): Promise<void> {
        const newOpts = await this.getAll();

        // Find options not already in storage
        for (const [ optName, optVal ] of Object.entries(defaults)) {
            if (!newOpts.hasOwnProperty(optName)) {
                newOpts[optName] = optVal;
            }
        }

        // Update storage with default values of new options
        return this.setAll(newOpts);
    }
};
