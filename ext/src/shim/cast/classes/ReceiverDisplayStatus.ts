"use strict";

import Image from "./Image";


// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.ReceiverDisplayStatus
export default class ReceiverDisplayStatus {
    public showStop: boolean = null;

    constructor (
            public statusText: string
          , public appImages: Image[]) {}
};
