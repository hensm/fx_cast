"use strict";

export default class QueueUpdateItemsRequest {
    constructor (itemsToUpdate) {
        this.customData = null;
        this.items = itemsToUpdate;
        this.requestId = null;
        this.sessionId = null;
        this.type = "QUEUE_UPDATE";
    }
}
