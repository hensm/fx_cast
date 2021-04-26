"use strict";

export default class QueueSetPropertiesRequest {
    public customData: any = null;
    public repeatMode: (string | null) = null;
    public requestId: (number | null) = null;
    public sessionId: (string | null) = null;
    public type = "QUEUE_UPDATE";
}
