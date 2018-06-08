"use strict";

import { RepeatMode } from "../enums";

export default class QueueLoadRequest {
    constructor (items) {
        this.customData = {};
        this.items = items;
        this.repeatMode = RepeatMode.OFF;
        this.startIndex = 0;
    }
}
