"use strict";

import { VolumeControlType } from "../enums";


// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.Volume
export default class Volume {
    constructor (
            public level = null
          , public muted = null) {
    }
};
