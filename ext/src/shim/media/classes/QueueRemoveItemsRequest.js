"use strict";

export default class QueueRemoveItemsRequest {
    constructor (itemIdsToRemove) {
        this.customData = null;
        this.itemIds = itemIdsToRemove;
        this.requestId = null;
        this.sessionId = null;
        this.type = "QUEUE_REMOVE";
    }
}
