"use strict";

import Image from "../../classes/Image";

import { MetadataType } from "../enums";


export default class AudiobookChapterMediaMetadata {
    public bookTitle?: string;
    public chapterNumber?: number;
    public chapterTitle?: string;
    public images?: Image[];
    public subtitle?: string;
    public title?: string;
    public type = MetadataType.AUDIOBOOK_CHAPTER;
}
