"use strict";

import Image from "../../classes/Image";

import { MetadataType } from "../enums";


export default class MusicTrackMediaMetadata {
    public albumArtist: (string | undefined) = undefined;
    public albumName: (string | undefined) = undefined;
    public artist: (string | undefined) = undefined;
    public artistName: (string | undefined) = undefined;
    public composer: (string | undefined) = undefined;
    public discNumber: (number | undefined) = undefined;
    public images: (Image[] | undefined) = undefined;
    public metadataType: number = MetadataType.MUSIC_TRACK;
    public releaseDate: (string | undefined) = undefined;
    public releaseYear: (number | undefined) = undefined;
    public songName: (string | undefined) = undefined;
    public title: (string | undefined) = undefined;
    public trackNumber: (number | undefined) = undefined;
    public type: number = MetadataType.MUSIC_TRACK;
}
