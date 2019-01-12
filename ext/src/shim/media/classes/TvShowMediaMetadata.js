"use strict";

import { MetadataType } from "../enums";

export default class TvShowMediaMetadata {
    constructor () {
        this.episode = null;
        this.episodeNumber = null;
        this.episodeTitle = null;
        this.images = null;
        this.metadataType = MetadataType.TV_SHOW;
        this.originalAirdate = null;
        this.releaseYear = null;
        this.season = null;
        this.seasonNumber = null;
        this.seriesTitle = null;
        this.title = null;
        this.type = MetadataType.TV_SHOW;
    }
}
