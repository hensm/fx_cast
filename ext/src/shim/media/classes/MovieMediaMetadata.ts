"use strict";

import Image from "../../cast/classes/Image";

import { MetadataType } from "../enums";


export default class MovieMediaMetadata {
    public images: Image[] = null;
    public metadataType: number = MetadataType.MOVIE;
    public releaseDate: string = null;
    public releaseYear: number = null;
    public studio: string = null;
    public subtitle: string = null;
    public title: string = null;
    public type: number = MetadataType.MOVIE;
}
