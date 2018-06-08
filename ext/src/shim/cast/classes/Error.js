"use strict";

// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.Error
export default class Error {
    constructor (
            code
          , opt_description = null
          , opt_details = null) {

        this.code = code;
        this.description = opt_description;
        this.details = opt_details;
    }
};
