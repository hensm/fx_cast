"use strict";

export default class QueueItem {
  constructor (mediaInfo) {
        this.activeTrackIds = [];
        this.autoplay = false;
        this.customData = {};
        this.itemId = null;
        this.media = mediaInfo;
        this.preloadTime = 10;
        this.startTime = 0;
    }
}
