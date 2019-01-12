"use strict";

import { MetadataType } from "../enums";

export default class PhotoMediaMetadata {
  constructor () {
        this.artist = null;
        this.creationDateTime = null;
        this.height = null;
        this.images = null;
        this.latitude = null;
        this.location = null;
        this.longitude = null;
        this.metadataType = MetadataType.PHOTO;
        this.title = null;
        this.type = MetadataType.PHOTO;
        this.width = null;
    }
}
