"use strict";

import Image from "../../cast/classes/Image";

import { MetadataType } from "../enums";


export default class MusicTrackMediaMetadata {
    public albumArtist: string = null;
    public albumName: string = null;
    public artist: string = null;
    public artistName: string = null;
    public composer: string = null;
    public discNumber: number = null;
    public images: Image[] = null;
    public metadataType: number = MetadataType.MUSIC_TRACK;
    public releaseDate: string = null;
    public releaseYear: number = null;
    public songName: string = null;
    public title: string = null;
    public trackNumber: number = null;
    public type: number = MetadataType.MUSIC_TRACK;
}
