"use strict";

import GenericMediaMetadata from "./GenericMediaMetadata";
import MovieMediaMetadata from "./MovieMediaMetadata";
import MusicTrackMediaMetadata from "./MusicTrackMediaMetadata";
import PhotoMediaMetadata from "./PhotoMediaMetadata";
import TvShowMediaMetadata from "./TvShowMediaMetadata";

import TextTrackStyle from "./TextTrackStyle";
import Track from "./Track";

import { StreamType } from "../enums";


type Metadata =
        GenericMediaMetadata
      | MovieMediaMetadata
      | MusicTrackMediaMetadata
      | PhotoMediaMetadata
      | TvShowMediaMetadata;

export default class MediaInfo {
    public customData: any = null;
    public duration: (number | null) = null;
    public metadata: (Metadata | null) = null;
    public streamType: string = StreamType.BUFFERED;
    public textTrackStyle: (TextTrackStyle | null) = null;
    public tracks: (Track[] | null) = null;

    constructor (
            public contentId: string
          , public contentType: string) {}
}
