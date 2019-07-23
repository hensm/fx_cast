"use strict";

import defaultOptions from "../defaultOptions";


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

/**
 * Fetches `options` key from storage and returns it as
 * Options interface type.
 */
async function getAll (): Promise<Options> {
    const { options }: { options: Options } =
            await browser.storage.sync.get("options");

    return options;
}

/**
 * Takes Options object and sets to `options` storage key.
 * Returns storage promise.
 */
async function setAll (options: Options): Promise<void> {
    return browser.storage.sync.set({ options });
}

/**
 * Gets specific option from storage and returns it as its
 * type from Options interface type.
 */
async function get<T extends keyof Options> (name: T): Promise<Options[T]> {
    const options = await getAll();

    if (options.hasOwnProperty(name)) {
        return options[name];
    }
}

/**
 * Sets specific option to storage. Returns storage
 * promise.
 */
async function set<T extends keyof Options> (
        name: T
      , value: Options[T]): Promise<void> {

    const options = await getAll();
    options[name] = value;
    return setAll(options);
}


/**
 * Gets existing options from storage and compares it
 * against defaults. Any options in defaults and not in
 * storage are set. Does not override any existing options.
 */
async function update (defaults = defaultOptions): Promise<void> {
    const oldOpts = await getAll();
    const newOpts: Partial<Options> = {};

    // Find options not already in storage
    for (const [ optName, optVal ] of Object.entries(defaults)) {
        if (!oldOpts.hasOwnProperty(optName)) {
            newOpts[optName] = optVal;
        }
    }

    // Update storage with default values of new options
    return setAll({
        ...oldOpts
      , ...newOpts
    });
}


export default {
    get, getAll
  , set, setAll
  , update
};
