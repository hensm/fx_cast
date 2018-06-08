"use strict";

export default class QueueRemoveItemsRequest {
    constructor (itemIdsToRemove) {
        this.customData = {};
        this.itemIds = itemIdsToRemove;
    }
}
