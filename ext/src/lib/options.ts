"use strict";

import defaultOptions from "../defaultOptions";

import { TypedEventTarget } from "./typedEvents";
import { Message } from "../types";


export interface Options {
    bridgeApplicationName: string;
    mediaEnabled: boolean;
    mediaSyncElement: boolean;
    mediaStopOnUnload: boolean;
    localMediaEnabled: boolean;
    localMediaServerPort: number;
    mirroringEnabled: boolean;
    mirroringAppId: string;
    userAgentWhitelistEnabled: boolean;
    userAgentWhitelist: string[];

    [key: string]: Options[keyof Options];
}


class DispatcherEvents {
    "changed": Array<keyof Options>
}

class Dispatcher extends TypedEventTarget<DispatcherEvents> {
    constructor () {
        super();

        browser.runtime.onMessage.addListener((message: Message) => {
            if (message.subject === "optionsUpdated") {
                this.dispatchEvent(new CustomEvent("changed", {
                    detail: message.data.alteredOptions
                }));
            }
        });
    }

    /**
     * Fetches `options` key from storage and returns it as
     * Options interface type.
     */
    async getAll (): Promise<Options> {
        const { options }: { options: Options } =
                await browser.storage.sync.get("options");

        return options;
    }

    /**
     * Takes Options object and sets to `options` storage key.
     * Returns storage promise.
     */
    async setAll (options: Options): Promise<void> {
        return browser.storage.sync.set({ options });
    }

    /**
     * Gets specific option from storage and returns it as its
     * type from Options interface type.
     */
    async get<T extends keyof Options> (name: T): Promise<Options[T]> {
        const options = await this.getAll();

        if (options.hasOwnProperty(name)) {
            return options[name];
        }
    }

    /**
     * Sets specific option to storage. Returns storage
     * promise.
     */
    async set<T extends keyof Options> (
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
    async update (defaults = defaultOptions): Promise<void> {
        const oldOpts = await this.getAll();
        const newOpts: Partial<Options> = {};

        // Find options not already in storage
        for (const [ optName, optVal ] of Object.entries(defaults)) {
            if (!oldOpts.hasOwnProperty(optName)) {
                newOpts[optName] = optVal;
            }
        }

        // Update storage with default values of new options
        return this.setAll({
            ...oldOpts
          , ...newOpts
        });
    }
}

export default new Dispatcher();
