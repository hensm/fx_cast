"use strict";

export default class QueueInsertItemsRequest {
  constructor (itemsToInsert) {
        this.customData = {};
        this.insertBefore = null;
        this.items = itemsToInsert;
    }
}
