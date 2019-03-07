"use strict";

import * as timeouts from "../../timeout";

// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.Timeout
export default class Timeout {
    constructor () {
        Object.assign(this, timeouts);
    }
};
