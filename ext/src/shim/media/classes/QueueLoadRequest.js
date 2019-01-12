"use strict";

import { RepeatMode } from "../enums";

export default class QueueLoadRequest {
    constructor (items) {
        this.customData = null;
        this.items = items;
        this.repeatMode = RepeatMode.OFF;
        this.requestId = null;
        this.sessionId = null;
        this.startIndex = 0;
        this.type = "QUEUE_LOAD";
    }
}
