"use strict";

import Image from "../../classes/Image";

import { MetadataType } from "../enums";


export default class GenericMediaMetadata {
    public images: Image[] = undefined;
    public metadataType: number = MetadataType.GENERIC;
    public releaseDate: string = undefined;
    public releaseYear: number = undefined;
    public subtitle: string = undefined;
    public title: string = undefined;
    public type: number = MetadataType.GENERIC;
}
