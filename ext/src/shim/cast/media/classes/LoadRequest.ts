"use strict";

import MediaInfo from "./MediaInfo";


export default class LoadRequest {
    public activeTrackIds: number[] = null;
    public autoplay: boolean = true;
    public currentTime: number = null;
    public customData: any = null;
    public media: MediaInfo;
    public requestId: number = 0;
    public sessionId: string = null;
    public type: string = "LOAD";

    constructor (mediaInfo: MediaInfo) {
        this.media = mediaInfo;
    }
}
