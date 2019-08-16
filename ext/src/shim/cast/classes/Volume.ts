"use strict";

import { VolumeControlType } from "../enums";


// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.Volume
export default class Volume {
    public controlType: VolumeControlType;
    public stepInterval: number;

    constructor (
            public level: number = null
          , public muted: boolean = null) {
    }
}
