"use strict";

import Session from "./Session";
import SessionRequest from "./SessionRequest";

import { AutoJoinPolicy
       , DefaultActionPolicy } from "../enums";


export default class ApiConfig {
    public additionalSessionRequests: any[] = [];
    public customDialLaunchCallback: any = null;
    public invisibleSender = false;

    constructor (
            public sessionRequest: SessionRequest
          , public sessionListener: (session: Session) => void
          , public receiverListener: (availability: string) => void

          , public autoJoinPolicy: string
                    = AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED
          , public defaultActionPolicy: string
                    = DefaultActionPolicy.CREATE_SESSION) {}
}
