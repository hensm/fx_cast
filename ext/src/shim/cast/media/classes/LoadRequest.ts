"use strict";

import MediaInfo from "./MediaInfo";


export default class LoadRequest {
    public activeTrackIds: (number[] | null) = null;
    public autoplay: (boolean | null) = true;
    public currentTime: (number | null) = null;
    public customData: any = null;
    public media: MediaInfo;
    public requestId: number = 0;
    public sessionId: (string | null) = null;
    public type: string = "LOAD";

    constructor (mediaInfo: MediaInfo) {
        this.media = mediaInfo;
    }
}
