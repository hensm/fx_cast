"use strict";

export default class QueueReorderItemsRequest {
    public customData: any = null;
    public insertBefore: number = null;
    public requestId: number = null;
    public sessionId: string = null;
    public type: string = "QUEUE_REORDER";

    constructor (
            public itemIds: number[]) {}
}
