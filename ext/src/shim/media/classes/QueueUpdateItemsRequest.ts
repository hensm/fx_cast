"use strict";

import QueueItem from "./QueueItem";


export default class QueueUpdateItemsRequest {
    public customData: any = null;
    public requestId: number = null;
    public sessionId: string = null;
    public type: string = "QUEUE_UPDATE";

    constructor (
            public items: QueueItem[]) {}
}
