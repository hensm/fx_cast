"use strict";

/**
 * Allows typed access to a StorageArea.
 *
 * Provide a string-keyed schema as a type parameter with
 * the specified storage area.
 */
export class TypedStorageArea<Schema extends { [key: string]: any }> {
    private storageArea: any;

    constructor(storageArea: browser.storage.StorageArea) {
        this.storageArea = storageArea;
    }

    public async get<
        SchemaKey extends keyof Schema,
        SchemaPartial extends Partial<Schema>
    >(
        keys?: SchemaKey | SchemaKey[] | SchemaPartial | null | undefined
    ): Promise<Pick<Schema, Extract<keyof SchemaPartial, SchemaKey>>> {
        return await this.storageArea.get(keys);
    }

    public async getBytesInUse<SchemaKey extends keyof Schema>(
        keys?: Schema | SchemaKey[]
    ): Promise<number> {
        return await this.storageArea.getBytesInUse(keys);
    }

    public async set(keys: Partial<Schema>): Promise<void> {
        await this.storageArea.set(keys);
    }

    public async remove<SchemaKey extends keyof Schema>(
        keys: SchemaKey | SchemaKey[]
    ): Promise<void> {
        await this.storageArea.remove(keys);
    }

    public async clear(): Promise<void> {
        await this.storageArea.clear();
    }
}
