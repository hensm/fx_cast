"use strict";

import { MetadataType } from "../enums";

export default class MusicTrackMediaMetadata {
  constructor () {
        this.albumArtist = null;
        this.albumName = null;
        this.artist = null;
        this.artistName = null;
        this.composer = null;
        this.discNumber = null;
        this.images = null;
        this.metadataType = MetadataType.MUSIC_TRACK;
        this.releaseDate = null;
        this.releaseYear = null;
        this.songName = null;
        this.title = null;
        this.trackNumber = null;
        this.type = MetadataType.MUSIC_TRACK;
    }
}
