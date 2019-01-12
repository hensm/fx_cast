"use strict";

export default class QueueReorderItemsRequest {
  constructor (itemIdsToReorder) {
        this.customData = null;
        this.insertBefore = null;
        this.itemIds = itemIdsToReorder;
        this.requestId = null;
        this.sessionId = null;
        this.type = "QUEUE_REORDER";
    }
}
