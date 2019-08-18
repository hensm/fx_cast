"use strict";

import Image from "../../classes/Image";

import { MetadataType } from "../enums";


export default class MusicTrackMediaMetadata {
    public albumArtist: string = undefined;
    public albumName: string = undefined;
    public artist: string = undefined;
    public artistName: string = undefined;
    public composer: string = undefined;
    public discNumber: number = undefined;
    public images: Image[] = undefined;
    public metadataType: number = MetadataType.MUSIC_TRACK;
    public releaseDate: string = undefined;
    public releaseYear: number = undefined;
    public songName: string = undefined;
    public title: string = undefined;
    public trackNumber: number = undefined;
    public type: number = MetadataType.MUSIC_TRACK;
}
