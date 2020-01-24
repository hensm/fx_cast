"use strict";

import Image from "../../classes/Image";

import { MetadataType } from "../enums";


export default class PhotoMediaMetadata {
    public artist: (string | undefined) = undefined;
    public creationDateTime: (string | undefined) = undefined;
    public height: (number | undefined) = undefined;
    public images: (Image[] | undefined) = undefined;
    public latitude: (number | undefined) = undefined;
    public location: (string | undefined) = undefined;
    public longitude: (number | undefined) = undefined;
    public metadataType: number = MetadataType.PHOTO;
    public title: (string | undefined) = undefined;
    public type: number = MetadataType.PHOTO;
    public width: (number | undefined) = undefined;
}
