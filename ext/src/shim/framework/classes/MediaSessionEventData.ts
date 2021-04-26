"use strict";

import * as cast from "../../cast";

import EventData from "./EventData";

import { SessionEventType } from "../enums";


export default class MediaSessionEventData extends EventData {
    constructor(
            public mediaSession: cast.media.Media) {

        super(SessionEventType.MEDIA_SESSION);
    }
}
