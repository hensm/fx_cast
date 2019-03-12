"use strict";

export default class QueueRemoveItemsRequest {
    public customData: any = null;
    public requestId: number = null;
    public sessionId: string = null;
    public type: string = "QUEUE_REMOVE";

    constructor (
            public itemIds: number[]) {}
}
