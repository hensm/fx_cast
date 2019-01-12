"use strict";

import { MetadataType } from "../enums";

export default class GenericMediaMetadata {
    constructor () {
        this.images = null;
        this.metadataType = MetadataType.GENERIC;
        this.releaseDate = null;
        this.releaseYear = null;
        this.subtitle = null;
        this.title = null;
        this.type = MetadataType.GENERIC;
    }
}
