"use strict";

import QueueItem from "./QueueItem";

import { RepeatMode } from "../enums";


export default class QueueJumpRequest {
    public jump: (number | null) = null;
    public currentItemId: (number | null) = null;
    public sessionId: (number | null) = null;
    public requestId: (number | null) = null;

    public type = "QUEUE_UPDATE";
}
