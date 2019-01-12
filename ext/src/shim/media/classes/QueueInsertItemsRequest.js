"use strict";

export default class QueueInsertItemsRequest {
  constructor (itemsToInsert) {
        this.customData = null;
        this.insertBefore = null;
        this.items = itemsToInsert;
        this.requestId = null;
        this.sessionId = null;
        this.type = "QUEUE_INSERT";
    }
}
