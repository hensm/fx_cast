"use strict";

import Image from "../../classes/Image";

import { MetadataType } from "../enums";


export default class MovieMediaMetadata {
    public images: (Image[] | undefined) = undefined;
    public metadataType: number = MetadataType.MOVIE;
    public releaseDate: (string | undefined) = undefined;
    public releaseYear: (number | undefined) = undefined;
    public studio: (string | undefined) = undefined;
    public subtitle: (string | undefined) = undefined;
    public title: (string | undefined) = undefined;
    public type: number = MetadataType.MOVIE;
}
