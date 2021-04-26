"use strict";

export default class EditTracksInfoRequest {
    public requestId = 0;

    constructor(
            public activeTrackIds: (number[] | null) = null
          , public textTrackStyle: (string | null) = null) {
    }
}
