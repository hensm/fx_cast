"use strict";

export default class Track {
    constructor (trackId, trackType) {
        this.customData = {};
        this.language = null;
        this.name = null;
        this.subtype = null;
        this.trackContentId = null;
        this.trackContentType = null;
        this.trackId = trackId;
        this.type = trackType;
    }
}
