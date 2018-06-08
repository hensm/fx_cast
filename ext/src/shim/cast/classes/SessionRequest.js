"use strict";

import { Capability } from "../enums";
import { requestSession as requestSessionTimeout } from "../../timeout.js";

// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.SessionRequest
export default class SessionRequest {
    constructor (
            appId
          , opt_capabilities = [
                Capability.VIDEO_OUT
              , Capability.AUDIO_OUT ]
          , opt_timeout = null) {

        this.appId = appId;
        this.capabilities = opt_capabilities;
        this.language = null;
        this.requestSessionTimeout = requestSessionTimeout;
    }
};
