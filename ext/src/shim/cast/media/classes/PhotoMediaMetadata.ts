"use strict";

import Image from "../../classes/Image";

import { MetadataType } from "../enums";


export default class PhotoMediaMetadata {
    public artist: string = undefined;
    public creationDateTime: string = undefined;
    public height: number = undefined;
    public images: Image[] = undefined;
    public latitude: number = undefined;
    public location: string = undefined;
    public longitude: number = undefined;
    public metadataType: number = MetadataType.PHOTO;
    public title: string = undefined;
    public type: number = MetadataType.PHOTO;
    public width: number = undefined;
}
