"use strict";

import Media from "../../cast/media/classes/Media";

import EventData from "./EventData";

import { SessionEventType } from "../enums";


export default class ApplicationStatusEventData extends EventData {
    constructor (
            public mediaSession: Media) {

        super(SessionEventType.MEDIA_SESSION);
    }
}
