"use strict";

import { AutoJoinPolicy
       , DefaultActionPolicy } from "../enums";

export default class ApiConfig {
    constructor (
            sessionRequest
          , sessionListener
          , receiverListener
          , opt_autoJoinPolicy = AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED
          , opt_defaultActionPolicy = DefaultActionPolicy.CREATE_SESSION
            // TODO: Remove awful hack for mirror casting
          , selectedMedia = "app") {

        this.autoJoinPolicy = opt_autoJoinPolicy;
        this.defaultActionPolicy = opt_defaultActionPolicy;
        this.receiverListener = receiverListener;
        this.sessionListener = sessionListener;
        this.sessionRequest = sessionRequest;

        this.additionalSessionRequests = [];
        this.customDialLaunchCallback = null;
        this.invisibleSender = false;

        this._selectedMedia = selectedMedia;
    }
};
