"use strict";

import Break from "./Break";
import BreakClip from "./BreakClip";
import GenericMediaMetadata from "./GenericMediaMetadata";
import MovieMediaMetadata from "./MovieMediaMetadata";
import MusicTrackMediaMetadata from "./MusicTrackMediaMetadata";
import PhotoMediaMetadata from "./PhotoMediaMetadata";
import TvShowMediaMetadata from "./TvShowMediaMetadata";
import TextTrackStyle from "./TextTrackStyle";
import Track from "./Track";
import UserActionState from "./UserActionState";
import VastAdsRequest from "./VastAdsRequest";

import { HlsSegmentFormat
       , HlsVideoSegmentFormat
       , StreamType } from "../enums";


type Metadata =
        GenericMediaMetadata
      | MovieMediaMetadata
      | MusicTrackMediaMetadata
      | PhotoMediaMetadata
      | TvShowMediaMetadata;

export default class MediaInfo {
    public atvEntity?: string;
    public breakClips?: BreakClip[];
    public breaks?: Break[];
    public customData: any = null;
    public contentUrl?: string;
    public duration: (number | null) = null;
    public entity?: string;
    public hlsSegmentFormat?: HlsSegmentFormat;
    public hlsVideoSegmentFormat?: HlsVideoSegmentFormat;
    public metadata: (Metadata | null) = null;
    public startAbsoluteTime?: number;
    public streamType: string = StreamType.BUFFERED;
    public textTrackStyle: (TextTrackStyle | null) = null;
    public tracks: (Track[] | null) = null;
    public userActionStates?: UserActionState[];
    public vmapAdsRequest?: VastAdsRequest;

    constructor(
            public contentId: string
          , public contentType: string) {}
}
