"use strict";

import Image from "../../classes/Image";

import { MetadataType } from "../enums";


export default class GenericMediaMetadata {
    public images: Image[] = null;
    public metadataType: number = MetadataType.GENERIC;
    public releaseDate: string = null;
    public releaseYear: number = null;
    public subtitle: string = null;
    public title: string = null;
    public type: number = MetadataType.GENERIC;
}
