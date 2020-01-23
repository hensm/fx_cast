"use strict";

import Image from "../../classes/Image";

import { MetadataType } from "../enums";


export default class TvShowMediaMetadata {
    public episode: (number | undefined) = undefined;
    public episodeNumber: (number | undefined) = undefined;
    public episodeTitle: (string | undefined) = undefined;
    public images: (Image[] | undefined) = undefined;
    public metadataType: number = MetadataType.TV_SHOW;
    public originalAirdate: (string | undefined) = undefined;
    public releaseYear: (number | undefined) = undefined;
    public season: (number | undefined) = undefined;
    public seasonNumber: (number | undefined) = undefined;
    public seriesTitle: (string | undefined) = undefined;
    public title: (string | undefined) = undefined;
    public type: number = MetadataType.TV_SHOW;
}
