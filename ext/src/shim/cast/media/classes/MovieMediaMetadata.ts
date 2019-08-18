"use strict";

import Image from "../../classes/Image";

import { MetadataType } from "../enums";


export default class MovieMediaMetadata {
    public images: Image[] = undefined;
    public metadataType: number = MetadataType.MOVIE;
    public releaseDate: string = undefined;
    public releaseYear: number = undefined;
    public studio: string = undefined;
    public subtitle: string = undefined;
    public title: string = undefined;
    public type: number = MetadataType.MOVIE;
}
