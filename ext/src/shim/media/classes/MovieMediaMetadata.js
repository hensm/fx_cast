"use strict";

import { MetadataType } from "../enums";

export default class MovieMediaMetadata {
    constructor () {
        this.images = null;
        this.metadataType = MetadataType.MOVIE;
        this.releaseDate = null;
        this.releaseYear = null;
        this.studio = null;
        this.subtitle = null;
        this.title = null;
        this.type = MetadataType.MOVIE;
    }
}
