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
    public customData: string = null;
    public duration: number = null;
    public metadata: Metadata = null;
    public streamType: string = StreamType.BUFFERED;
    public textTrackStyle: TextTrackStyle = null;
    public tracks: Track[] = null;

	constructor (
            public contentId: string
          , public contentType: string) {}
}
