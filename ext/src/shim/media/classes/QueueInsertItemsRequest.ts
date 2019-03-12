"use strict";

import QueueItem from "./QueueItem";


export default class QueueInsertItemsRequest {
    public customData: any = null;
    public insertBefore: number = null;
    public requestId: number = null;
    public sessionId: string = null;
    public type: string = "QUEUE_INSERT";

    constructor (
            public items: QueueItem[]) {}
}
