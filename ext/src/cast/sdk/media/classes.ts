"use strict";

import type { Image, Volume } from "../classes";

import {
    ContainerType,
    HdrType,
    HlsSegmentFormat,
    HlsVideoSegmentFormat,
    MetadataType,
    RepeatMode,
    ResumeState,
    StreamType,
    TrackType,
    UserAction
} from "./enums";

export class AudiobookContainerMetadata {
    authors?: string[];
    narrators?: string[];
    publisher?: string;
    releaseDate?: string;
}

export class Break {
    duration?: number;
    isEmbedded?: boolean;
    isWatched = false;

    constructor(
        public id: string,
        public breakClipIds: string[],
        public position: number
    ) {}
}

export class BreakClip {
    clickThroughUrl?: string;
    contentId?: string;
    contentType?: string;
    contentUrl?: string;
    customData?: unknown;
    duration?: number;
    hlsSegmentFormat?: HlsSegmentFormat;
    posterUrl?: string;
    title?: string;
    vastAdsRequest?: VastAdsRequest;
    whenSkippable?: number;

    constructor(public id: string) {}
}

export class BreakStatus {
    breakClipId?: string;
    breakId?: string;
    currentBreakClipTime?: number;
    currentBreakTime?: number;
    whenSkippable?: number;
}

export class ContainerMetadata {
    containerDuration?: number;
    containerImages?: Image[];
    sections?: Metadata[];
    title?: string;

    constructor(
        public containerType: ContainerType = ContainerType.GENERIC_CONTAINER
    ) {}
}

export class EditTracksInfoRequest {
    requestId = 0;

    constructor(
        public activeTrackIds: Nullable<number[]> = null,
        public textTrackStyle: Nullable<string> = null
    ) {}
}

export class GetStatusRequest {
    customData: unknown = null;
}

export class LiveSeekableRange {
    constructor(
        public start?: number,
        public end?: number,
        public isMovingWindow?: boolean,
        public isLiveDone?: boolean
    ) {}
}

export class LoadRequest {
    activeTrackIds: Nullable<number[]> = null;
    atvCredentials?: string;
    atvCredentialsType?: string;
    autoplay: Nullable<boolean> = true;
    currentTime: Nullable<number> = null;
    customData: unknown = null;
    media: MediaInfo;
    requestId = 0;
    sessionId: Nullable<string> = null;
    type: "LOAD" = "LOAD";

    constructor(mediaInfo: MediaInfo) {
        this.media = mediaInfo;
    }
}

export type Metadata =
    | AudiobookChapterMediaMetadata
    | GenericMediaMetadata
    | MovieMediaMetadata
    | MusicTrackMediaMetadata
    | PhotoMediaMetadata
    | TvShowMediaMetadata;

export class MediaInfo {
    atvEntity?: string;
    breakClips?: BreakClip[];
    breaks?: Break[];
    customData: unknown = null;
    contentUrl?: string;
    duration: Nullable<number> = null;
    entity?: string;
    hlsSegmentFormat?: HlsSegmentFormat;
    hlsVideoSegmentFormat?: HlsVideoSegmentFormat;
    metadata: Nullable<Metadata> = null;
    startAbsoluteTime?: number;
    streamType: string = StreamType.BUFFERED;
    textTrackStyle: Nullable<TextTrackStyle> = null;
    tracks: Nullable<Track[]> = null;
    userActionStates?: UserActionState[];
    vmapAdsRequest?: VastAdsRequest;

    constructor(public contentId: string, public contentType: string) {}
}

export abstract class MediaMetadata<T extends MetadataType> {
    queueItemId?: number;
    sectionDuration?: number;
    sectionStartAbsoluteTime?: number;
    sectionStartTimeInContainer?: number;
    sectionStartTimeInMedia?: number;
    type: T;
    metadataType: T;

    constructor(type: T) {
        this.type = type;
        this.metadataType = type;
    }
}

export class AudiobookChapterMediaMetadata extends MediaMetadata<MetadataType.AUDIOBOOK_CHAPTER> {
    bookTitle?: string;
    chapterNumber?: number;
    chapterTitle?: string;
    images?: Image[];
    subtitle?: string;
    title?: string;

    constructor() {
        super(MetadataType.AUDIOBOOK_CHAPTER);
    }
}

export class GenericMediaMetadata extends MediaMetadata<MetadataType.GENERIC> {
    images?: Image[];
    releaseDate?: string;
    releaseYear?: number;
    subtitle?: string;
    title?: string;

    constructor() {
        super(MetadataType.GENERIC);
    }
}

export class MovieMediaMetadata extends MediaMetadata<MetadataType.MOVIE> {
    images?: Image[];
    releaseDate?: string;
    releaseYear?: number;
    studio?: string;
    subtitle?: string;
    title?: string;

    constructor() {
        super(MetadataType.MOVIE);
    }
}

export class MusicTrackMediaMetadata extends MediaMetadata<MetadataType.MUSIC_TRACK> {
    albumArtist?: string;
    albumName?: string;
    artist?: string;
    artistName?: string;
    composer?: string;
    discNumber?: number;
    images?: Image[];
    releaseDate?: string;
    releaseYear?: number;
    songName?: string;
    title?: string;
    trackNumber?: number;

    constructor() {
        super(MetadataType.MUSIC_TRACK);
    }
}

export class PhotoMediaMetadata extends MediaMetadata<MetadataType.PHOTO> {
    artist?: string;
    creationDateTime?: string;
    height?: number;
    images?: Image[];
    latitude?: number;
    location?: string;
    longitude?: number;
    title?: string;
    width?: number;

    constructor() {
        super(MetadataType.PHOTO);
    }
}

export class TvShowMediaMetadata extends MediaMetadata<MetadataType.TV_SHOW> {
    episode?: number;
    episodeNumber?: number;
    episodeTitle?: string;
    images?: Image[];
    originalAirdate?: string;
    releaseYear?: number;
    season?: number;
    seasonNumber?: number;
    seriesTitle?: string;
    title?: string;

    constructor() {
        super(MetadataType.TV_SHOW);
    }
}

export class PauseRequest {
    customData: unknown = null;
}

export class PlayRequest {
    customData: unknown = null;
}

export class QueueData {
    shuffle = false;

    constructor(
        public id?: string,
        public name?: string,
        public description?: string,
        public repeatMode?: RepeatMode,
        public items?: QueueItem[],
        public startIndex?: number,
        public startTime?: number
    ) {}
}

export class QueueInsertItemsRequest {
    customData: unknown = null;
    insertBefore: Nullable<number> = null;
    requestId: Nullable<number> = null;
    sessionId: Nullable<string> = null;
    type = "QUEUE_INSERT";

    constructor(public items: QueueItem[]) {}
}

export class QueueItem {
    activeTrackIds: Nullable<number[]> = null;
    autoplay = true;
    customData: unknown = null;
    itemId: Nullable<number> = null;
    media: MediaInfo;
    playbackDuration: Nullable<number> = null;
    preloadTime = 0;
    startTime = 0;

    constructor(mediaInfo: MediaInfo) {
        this.media = mediaInfo;
    }
}

export class QueueJumpRequest {
    type = "QUEUE_UPDATE";
    jump: Nullable<number> = null;
    currentItemId: Nullable<number> = null;
}

export class QueueLoadRequest {
    type = "QUEUE_LOAD";
    customData: unknown = null;
    repeatMode: string = RepeatMode.OFF;
    startIndex = 0;

    constructor(public items: QueueItem[]) {}
}

export class QueueRemoveItemsRequest {
    type = "QUEUE_REMOVE";
    customData: unknown = null;

    constructor(public itemIds: number[]) {}
}

export class QueueReorderItemsRequest {
    customData: unknown = null;
    insertBefore: Nullable<number> = null;
    type = "QUEUE_REORDER";

    constructor(public itemIds: number[]) {}
}

export class QueueSetPropertiesRequest {
    type = "QUEUE_UPDATE";
    customData: unknown = null;
    repeatMode: Nullable<string> = null;
}

export class QueueUpdateItemsRequest {
    type = "QUEUE_UPDATE";
    customData: unknown = null;

    constructor(public items: QueueItem[]) {}
}

export class SeekRequest {
    currentTime: Nullable<number> = null;
    customData: unknown = null;
    resumeState: Nullable<ResumeState> = null;
}

export class StopRequest {
    customData: unknown = null;
}

export class TextTrackStyle {
    backgroundColor: Nullable<string> = null;
    customData: unknown = null;
    edgeColor: Nullable<string> = null;
    edgeType: Nullable<string> = null;
    fontFamily: Nullable<string> = null;
    fontGenericFamily: Nullable<string> = null;
    fontScale: Nullable<number> = null;
    fontStyle: Nullable<string> = null;
    foregroundColor: Nullable<string> = null;
    windowColor: Nullable<string> = null;
    windowRoundedCornerRadius: Nullable<number> = null;
    windowType: Nullable<string> = null;
}

export class Track {
    customData: unknown = null;
    language: Nullable<string> = null;
    name: Nullable<string> = null;
    subtype: Nullable<string> = null;
    trackContentId: Nullable<string> = null;
    trackContentType: Nullable<string> = null;

    constructor(public trackId: number, public type: TrackType) {}
}

export class UserActionState {
    customData: unknown = null;

    constructor(public userAction: UserAction) {}
}

export class VastAdsRequest {
    adsResponse?: string;
    adTagUrl?: string;
}

export class VideoInformation {
    constructor(
        public width: number,
        public height: number,
        public hdrType: HdrType
    ) {}
}

export class VolumeRequest {
    customData: unknown = null;

    constructor(public volume: Volume) {}
}
