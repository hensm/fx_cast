"use strict";

export default class QueueSetPropertiesRequest {
    constructor () {
        this.type = "QUEUE_UPDATE";
        this.customData = {};
        this.repeatMode = null;
        this.sessionId = null;
        this.requestId = null;
    }
}
