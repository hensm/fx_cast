"use strict";

import QueueItem from "./QueueItem";


export default class QueueInsertItemsRequest {
    public customData: any = null;
    public insertBefore: (number | null) = null;
    public requestId: (number | null) = null;
    public sessionId: (string | null) = null;
    public type: string = "QUEUE_INSERT";

    constructor (
            public items: QueueItem[]) {}
}
