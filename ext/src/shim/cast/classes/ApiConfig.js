"use strict";

import { AutoJoinPolicy
       , DefaultActionPolicy } from "../enums";

export default class ApiConfig {
    constructor (
            sessionRequest
          , sessionListener
          , receiverListener
          , opt_autoJoinPolicy = AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED
          , opt_defaultActionPolicy = DefaultActionPolicy.CREATE_SESSION) {

        this.autoJoinPolicy = opt_autoJoinPolicy;
        this.defaultActionPolicy = opt_defaultActionPolicy;
        this.receiverListener = receiverListener;
        this.sessionListener = sessionListener;
        this.sessionRequest = sessionRequest;
    }
};
