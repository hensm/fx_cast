"use strict";

import QueueItem from "./QueueItem";

import { RepeatMode } from "../enums";


export default class QueueLoadRequest {
    public customData: any = null;
    public repeatMode: string = RepeatMode.OFF;
    public requestId: number = null;
    public sessionId: string = null;
    public startIndex: number = 0;
    public type: string = "QUEUE_LOAD";

    constructor (
            public items: QueueItem[]) {}
}
