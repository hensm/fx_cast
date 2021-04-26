"use strict";

import QueueItem from "./QueueItem";

import { RepeatMode } from "../enums";


export default class QueueLoadRequest {
    public customData: any = null;
    public repeatMode: string = RepeatMode.OFF;
    public requestId: (number | null) = null;
    public sessionId: (string | null) = null;
    public startIndex = 0;
    public type = "QUEUE_LOAD";

    constructor(
            public items: QueueItem[]) {}
}
