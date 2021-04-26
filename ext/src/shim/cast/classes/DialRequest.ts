"use strict";

// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.DialRequest
export default class DialRequest {
    constructor(
            public appName: string
          , public launchParameter: (string | null) = null) {
    }
}
