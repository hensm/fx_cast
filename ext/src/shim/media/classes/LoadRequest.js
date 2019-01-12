"use strict";

export default class LoadRequest {
  constructor (mediaInfo) {
        this.activeTrackIds = null;
        this.autoplay = true;
        this.currentTime = null;
        this.customData = null;
        this.media = mediaInfo;
        this.requestId = 0;
        this.sessionId = null;
        this.type = "LOAD";
    }
}
