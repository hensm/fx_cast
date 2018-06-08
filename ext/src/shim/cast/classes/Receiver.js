"use strict";

import { Capability
       , ReceiverType } from "../enums";

// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.Receiver
export default class Receiver {
    constructor (
            label
          , friendlyName
          , opt_capabilities = [
                Capability.VIDEO_OUT
              , Capability.AUDIO_OUT ]
          , opt_volume = null) {

        this.capabilities = opt_capabilities;
        this.displayStatus = null;
        this.friendlyName = friendlyName;
        this.isActiveInput = null;
        this.label = label;
        this.receiverType = ReceiverType.CAST;
        this.volume = opt_volume;
    }
};
