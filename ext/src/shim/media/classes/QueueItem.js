"use strict";

export default class QueueItem {
  constructor (mediaInfo) {
        this.activeTrackIds = null;
        this.autoplay = true;
        this.customData = null;
        this.itemId = null;
        this.media = mediaInfo;
        this.playbackDuration = null;
        this.preloadTime = 0;
        this.startTime = 0;
    }
}
