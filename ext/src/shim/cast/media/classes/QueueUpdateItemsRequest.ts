"use strict";

import QueueItem from "./QueueItem";


export default class QueueUpdateItemsRequest {
    public customData: any = null;
    public requestId: (number | null) = null;
    public sessionId: (string | null) = null;
    public type: string = "QUEUE_UPDATE";

    constructor (
            public items: QueueItem[]) {}
}
