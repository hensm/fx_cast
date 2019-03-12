"use strict";

import Image from "../../cast/classes/Image";

import { MetadataType } from "../enums";


export default class PhotoMediaMetadata {
    public artist: string = null;
    public creationDateTime: string = null;
    public height: number = null;
    public images: Image[] = null;
    public latitude: number = null;
    public location: string = null;
    public longitude: number = null;
    public metadataType: number = MetadataType.PHOTO;
    public title: string = null;
    public type: number = MetadataType.PHOTO;
    public width: number = null;
}
