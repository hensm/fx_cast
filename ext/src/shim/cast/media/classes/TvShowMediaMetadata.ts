"use strict";

import Image from "../../classes/Image";

import { MetadataType } from "../enums";


export default class TvShowMediaMetadata {
    public episode: number = undefined;
    public episodeNumber: number = undefined;
    public episodeTitle: string = undefined;
    public images: Image[] = undefined;
    public metadataType: number = MetadataType.TV_SHOW;
    public originalAirdate: string = undefined;
    public releaseYear: number = undefined;
    public season: number = undefined;
    public seasonNumber: number = undefined;
    public seriesTitle: string = undefined;
    public title: string = undefined;
    public type: number = MetadataType.TV_SHOW;
}
