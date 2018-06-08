"use strict";

import { VolumeControlType } from "../enums";

// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.Volume
export default class Volume {
    constructor (
            opt_level = null
          , opt_muted = null) {
        this.level = opt_level;
        this.muted = opt_muted;
    }
};
