"use strict";

// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.DialRequest
export default class DialRequest {
    constructor (
            appName
          , opt_launchParameter = null) {

        this.appName = appName;
        this.launchParameter = opt_launchParameter;
    }
};
