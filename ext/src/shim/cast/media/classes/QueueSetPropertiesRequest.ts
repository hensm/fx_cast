"use strict";

export default class QueueSetPropertiesRequest {
    public customData: any = null;
    public repeatMode: string = null;
    public requestId: number = null;
    public sessionId: string = null;
    public type: string = "QUEUE_UPDATE";
}
