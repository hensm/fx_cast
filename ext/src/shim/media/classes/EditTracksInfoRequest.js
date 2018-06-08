"use strict";

export default class EditTracksInfoRequest {
    constructor (opt_activeTrackIds = null, opt_textTrackStyle = null) {
        this.activeTrackIds = opt_activeTrackIds;
        this.textTrackStyle = opt_textTrackStyle;
    }
}
