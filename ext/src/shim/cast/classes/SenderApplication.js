"use strict";

// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.SenderApplication
export default class SenderApplication {
    constructor (platform) {
        this.packageId = null;
        this.platform = platform;
        this.url = null;
    }
};
