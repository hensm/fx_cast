"use strict";

import EventData from "./EventData";

import { CastContextEventType } from "../enums";


export default class ApplicationStatusEventData extends EventData {
    constructor (
            public castState: string) {

        super(CastContextEventType.CAST_STATE_CHANGED);
    }
}
