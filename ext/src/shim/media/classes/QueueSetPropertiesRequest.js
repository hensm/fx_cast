"use strict";

export default class QueueSetPropertiesRequest {
    constructor () {
        this.customData = null;
        this.repeatMode = null;
        this.requestId = null;
        this.sessionId = null;
        this.type = "QUEUE_UPDATE";
    }
}
