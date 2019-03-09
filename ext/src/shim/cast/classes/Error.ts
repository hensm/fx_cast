"use strict";

// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.Error
export default class Error {
    constructor (
            public code: string
          , public description: string = null
          , public details: any = null) {
    }
};
