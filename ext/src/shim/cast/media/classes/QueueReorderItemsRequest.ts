"use strict";

export default class QueueReorderItemsRequest {
    public customData: any = null;
    public insertBefore: (number | null) = null;
    public requestId: (number | null) = null;
    public sessionId: (string | null) = null;
    public type = "QUEUE_REORDER";

    constructor(
            public itemIds: number[]) {}
}
