"use strict";

export default class ApiConfig {
    constructor (
            sessionRequest
          , sessionListener
          , receiverListener
          , opt_autoJoinPolicy
          , opt_defaultActionPolicy) {

        this.autoJoinPolicy
        this.receiverListener = receiverListener;
        this.sessionListener = sessionListener;
        this.sessionRequest = sessionRequest;
    }
};
