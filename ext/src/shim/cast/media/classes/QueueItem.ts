"use strict";

import MediaInfo from "./MediaInfo";


export default class QueueItem {
    public activeTrackIds: (number[] | null) = null;
    public autoplay = true;
    public customData: any = null;
    public itemId: (number | null) = null;
    public media: MediaInfo;
    public playbackDuration: (number | null) = null;
    public preloadTime = 0;
    public startTime = 0;

    constructor(mediaInfo: MediaInfo) {
        this.media = mediaInfo;
    }
}
