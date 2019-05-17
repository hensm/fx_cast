"use strict";

import { Options } from "../defaultOptions";


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


export default {
    get, getAll
  , set, setAll
}
