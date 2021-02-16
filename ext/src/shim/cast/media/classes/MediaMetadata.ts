"use strict";

import { MetadataType } from "../enums";


export default class MediaMetadata {
    public queueItemId?: number;
    public sectionDuration?: number;
    public sectionStartAbsoluteTime?: number;
    public sectionStartTimeInContainer?: number;
    public sectionStartTimeInMedia?: number;
    public type: MetadataType;
    public metadataType: MetadataType;

    constructor (type: MetadataType) {
        this.type = type;
        this.metadataType = type;
    }
}
