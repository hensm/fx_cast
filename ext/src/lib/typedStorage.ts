"use strict";

/**
 * Allows typed access to a StorageArea.
 *
 * Provide a string-keyed schema as a type parameter with
 * the specified storage area.
 */
export class TypedStorageArea<Schema extends { [key: string]: any }> {
    private storageArea: any;

    constructor (storageArea: browser.storage.StorageArea) {
        this.storageArea = storageArea;
    }

    /**
     * Retrieves one or more items from the storage area.
     *
     * @param keys -
     *  A string, array of strings or partial schema object
     *  (with default values) indicating which keys to retrieve
     *  from storage.
     */
    public async get<SchemaKey extends keyof Schema
                   , SchemaPartial extends Partial<Schema>> (
            keys?: SchemaKey
                 | SchemaKey[]
                 | SchemaPartial
                 | null | undefined)
            : Promise<Pick<Schema, Extract<
                    keyof SchemaPartial, SchemaKey>>> {

        return await this.storageArea.get(keys);
    }

    /**
     * Gets the amount of storage space — in bytes — used by one
     * or more items in the storage area.
     *
     * @param keys -
     *  A string or array of strings indicating the keys of
     *  which to get the storage space.
     */
    public async getBytesInUse<SchemaKey extends keyof Schema> (
            keys?: Schema | SchemaKey[]): Promise<number> {

        return await this.storageArea.getBytesInUse(keys);
    }

    /**
     * Stores one or more items in the storage area.
     *
     * @param keys -
     *  A partial schema object containing the items to be
     *  stored or updated.
     */
    public async set (keys: Partial<Schema>): Promise<void> {
        await this.storageArea.set(keys);
    }

    /**
     * Removes one or more items from the storage area.
     *
     * @param keys -
     *  A string or array of strings indicating which keys to
     *  remove from storage.
     */
    public async remove<SchemaKey extends keyof Schema> (
            keys: SchemaKey | SchemaKey[]): Promise<void> {

        await this.storageArea.remove(keys);
    }

    /**
     * Removes all items from the storage area.
     */
    public async clear (): Promise<void> {
        await this.storageArea.clear();
    }
}
