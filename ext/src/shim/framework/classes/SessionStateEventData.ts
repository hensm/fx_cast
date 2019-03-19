"use strict";

import { ErrorCode } from "../../cast/enums";

import CastSession from "./CastSession";
import EventData from "./EventData";

import { SessionEventType } from "../enums";


export default class ApplicationStatusEventData extends EventData {
    constructor (
            public session: CastSession
          , public sessionState: string
          , public errorCode: string = null) {

        super(SessionEventType.APPLICATION_STATUS_CHANGED);
    }
}
