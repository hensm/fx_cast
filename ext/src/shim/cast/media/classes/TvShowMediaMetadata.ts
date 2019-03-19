"use strict";

import Image from "../../classes/Image";

import { MetadataType } from "../enums";


export default class TvShowMediaMetadata {
    public episode: number = null;
    public episodeNumber: number = null;
    public episodeTitle: string = null;
    public images: Image[] = null;
    public metadataType: number = MetadataType.TV_SHOW;
    public originalAirdate: string = null;
    public releaseYear: number = null;
    public season: number = null;
    public seasonNumber: number = null;
    public seriesTitle: string = null;
    public title: string = null;
    public type: number = MetadataType.TV_SHOW;
}
