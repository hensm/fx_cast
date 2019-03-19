"use strict";

import { SessionEventType } from "../enums";


export default class ApplicationStatusEventData {
    public type = SessionEventType.VOLUME_CHANGED;

    constructor (
            public volume: number
          , public isMute: boolean) {}
}
