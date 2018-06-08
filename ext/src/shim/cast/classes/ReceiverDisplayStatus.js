"use strict";

// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.ReceiverDisplayStatus
export default class ReceiverDisplayStatus {
    constructor (statusText, appImages) {
        this.appImages = appImages;
        this.showStop = null;
        this.statusText = statusText;
    }
};
