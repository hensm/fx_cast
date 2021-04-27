"use strict";

import { Image, Volume } from "../dataClasses";

import { ContainerType
       , HdrType
       , HlsSegmentFormat
       , HlsVideoSegmentFormat
       , MetadataType
       , RepeatMode
       , StreamType
       , UserAction } from "./enums";


export class AudiobookChapterMediaMetadata {
    public bookTitle?: string;
    public chapterNumber?: number;
    public chapterTitle?: string;
    public images?: Image[];
    public subtitle?: string;
    public title?: string;
    public type = MetadataType.AUDIOBOOK_CHAPTER;
}


export class AudiobookContainerMetadata {
    public authors?: string[];
    public narrators?: string[];
    public publisher?: string;
    public releaseDate?: string;
}


export class Break {
    public duration?: number;
    public isEmbedded?: boolean;
    public isWatched = false;

    constructor(
            public id: string
          , public breakClipIds: string[]
          , public position: number) {}
}


export class BreakClip {
    public clickThroughUrl?: string;
    public contentId?: string;
    public contentType?: string;
    public contentUrl?: string;
    public customData?: {};
    public duration?: number;
    public hlsSegmentFormat?: HlsSegmentFormat;
    public posterUrl?: string;
    public title?: string;
    public vastAdsRequest?: VastAdsRequest;
    public whenSkippable?: number;

    constructor(public id: string) {}
}


export class BreakStatus {
    public breakClipId?: string;
    public breakId?: string;
    public currentBreakClipTime?: number;
    public currentBreakTime?: number;
    public whenSkippable?: number;
}


export class ContainerMetadata {
    public containerDuration?: number;
    public containerImages?: Image[];
    public sections?: MediaMetadata[];
    public title?: string;

    constructor(
            public containerType: ContainerType =
                    ContainerType.GENERIC_CONTAINER) {}
}


export class EditTracksInfoRequest {
    public requestId = 0;

    constructor(
            public activeTrackIds: (number[] | null) = null
          , public textTrackStyle: (string | null) = null) {
    }
}


export class GenericMediaMetadata {
    public images: (Image[] | undefined) = undefined;
    public metadataType: number = MetadataType.GENERIC;
    public releaseDate: (string | undefined) = undefined;
    public releaseYear: (number | undefined) = undefined;
    public subtitle: (string | undefined) = undefined;
    public title: (string | undefined) = undefined;
    public type: number = MetadataType.GENERIC;
}


export class GetStatusRequest {
    public customData: any = null;
}


export class LiveSeekableRange {
    constructor(
            public start?: number
          , public end?: number
          , public isMovingWindow?: boolean
          , public isLiveDone?: boolean) {}
}


export class LoadRequest {
    public activeTrackIds: (number[] | null) = null;
    public atvCredentials?: string;
    public atvCredentialsType?: string;
    public autoplay: (boolean | null) = true;
    public currentTime: (number | null) = null;
    public customData: any = null;
    public media: MediaInfo;
    public requestId = 0;
    public sessionId: (string | null) = null;
    public type = "LOAD";

    constructor(mediaInfo: MediaInfo) {
        this.media = mediaInfo;
    }
}


type Metadata =
        GenericMediaMetadata
      | MovieMediaMetadata
      | MusicTrackMediaMetadata
      | PhotoMediaMetadata
      | TvShowMediaMetadata;

export class MediaInfo {
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


export class MediaMetadata {
    public queueItemId?: number;
    public sectionDuration?: number;
    public sectionStartAbsoluteTime?: number;
    public sectionStartTimeInContainer?: number;
    public sectionStartTimeInMedia?: number;
    public type: MetadataType;
    public metadataType: MetadataType;

    constructor(type: MetadataType) {
        this.type = type;
        this.metadataType = type;
    }
}


export class MovieMediaMetadata {
    public images: (Image[] | undefined) = undefined;
    public metadataType: number = MetadataType.MOVIE;
    public releaseDate: (string | undefined) = undefined;
    public releaseYear: (number | undefined) = undefined;
    public studio: (string | undefined) = undefined;
    public subtitle: (string | undefined) = undefined;
    public title: (string | undefined) = undefined;
    public type: number = MetadataType.MOVIE;
}


export class MusicTrackMediaMetadata {
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


export class PauseRequest {
    public customData: any = null;
}


export class PhotoMediaMetadata {
    public artist: (string | undefined) = undefined;
    public creationDateTime: (string | undefined) = undefined;
    public height: (number | undefined) = undefined;
    public images: (Image[] | undefined) = undefined;
    public latitude: (number | undefined) = undefined;
    public location: (string | undefined) = undefined;
    public longitude: (number | undefined) = undefined;
    public metadataType: number = MetadataType.PHOTO;
    public title: (string | undefined) = undefined;
    public type: number = MetadataType.PHOTO;
    public width: (number | undefined) = undefined;
}


export class PlayRequest {
    public customData: any = null;
}


export class QueueData {
    public shuffle = false;

    constructor(
            public id?: string
          , public name?: string
          , public description?: string
          , public repeatMode?: RepeatMode
          , public items?: QueueItem[]
          , public startIndex?: number
          , public startTime?: number) {}
}


export class QueueInsertItemsRequest {
    public customData: any = null;
    public insertBefore: (number | null) = null;
    public requestId: (number | null) = null;
    public sessionId: (string | null) = null;
    public type = "QUEUE_INSERT";

    constructor(
            public items: QueueItem[]) {}
}


export class QueueItem {
    public activeTrackIds: (number[] | null) = null;
    public autoplay = true;
    public customData: any = null;
    public itemId: (number | null) = null;
    public media: MediaInfo;
    public playbackDuration: (number | null) = null;
    public preloadTime = 0;
    public startTime = 0;

    constructor(mediaInfo: MediaInfo) {
        this.media = mediaInfo;
    }
}


export class QueueJumpRequest {
    public jump: (number | null) = null;
    public currentItemId: (number | null) = null;
    public sessionId: (number | null) = null;
    public requestId: (number | null) = null;

    public type = "QUEUE_UPDATE";
}


export class QueueLoadRequest {
    public customData: any = null;
    public repeatMode: string = RepeatMode.OFF;
    public requestId: (number | null) = null;
    public sessionId: (string | null) = null;
    public startIndex = 0;
    public type = "QUEUE_LOAD";

    constructor(
            public items: QueueItem[]) {}
}


export class QueueRemoveItemsRequest {
    public customData: any = null;
    public requestId: (number | null) = null;
    public sessionId: (string | null) = null;
    public type = "QUEUE_REMOVE";

    constructor(
            public itemIds: number[]) {}
}


export class QueueReorderItemsRequest {
    public customData: any = null;
    public insertBefore: (number | null) = null;
    public requestId: (number | null) = null;
    public sessionId: (string | null) = null;
    public type = "QUEUE_REORDER";

    constructor(
            public itemIds: number[]) {}
}


export class QueueSetPropertiesRequest {
    public customData: any = null;
    public repeatMode: (string | null) = null;
    public requestId: (number | null) = null;
    public sessionId: (string | null) = null;
    public type = "QUEUE_UPDATE";
}


export class QueueUpdateItemsRequest {
    public customData: any = null;
    public requestId: (number | null) = null;
    public sessionId: (string | null) = null;
    public type = "QUEUE_UPDATE";

    constructor(
            public items: QueueItem[]) {}
}


export class SeekRequest {
    public currentTime: (number | null) = null;
    public customData: any = null;
    public resumeState: (string | null) = null;
}


export class StopRequest {
    public customData: any = null;
}


export class TextTrackStyle {
    public backgroundColor: (string | null) = null;
    public customData: any = null;
    public edgeColor: (string | null) = null;
    public edgeType: (string | null) = null;
    public fontFamily: (string | null) = null;
    public fontGenericFamily: (string | null) = null;
    public fontScale: (number | null) = null;
    public fontStyle: (string | null) = null;
    public foregroundColor: (string | null) = null;
    public windowColor: (string | null) = null;
    public windowRoundedCornerRadius: (number | null) = null;
    public windowType: (string | null) = null;
}


export class Track {
    public customData: any = null;
    public language: (string | null) = null;
    public name: (string | null) = null;
    public subtype: (string | null) = null;
    public trackContentId: (string | null) = null;
    public trackContentType: (string | null) = null;

    constructor(
            public trackId: number
          , public type: string) {}
}


export class TvShowMediaMetadata {
    public episode: (number | undefined) = undefined;
    public episodeNumber: (number | undefined) = undefined;
    public episodeTitle: (string | undefined) = undefined;
    public images: (Image[] | undefined) = undefined;
    public metadataType: number = MetadataType.TV_SHOW;
    public originalAirdate: (string | undefined) = undefined;
    public releaseYear: (number | undefined) = undefined;
    public season: (number | undefined) = undefined;
    public seasonNumber: (number | undefined) = undefined;
    public seriesTitle: (string | undefined) = undefined;
    public title: (string | undefined) = undefined;
    public type: number = MetadataType.TV_SHOW;
}


export class UserActionState {
    public customData: any = null;

    constructor(
            public userAction: UserAction) {}
}


export class VastAdsRequest {
    public adsResponse?: string;
    public adTagUrl?: string;
}


export class VideoInformation {
    constructor(
            public width: number
          , public height: number
          , public hdrType: HdrType) {}
}


export class VolumeRequest {
    public customData: any = null;

    constructor(
            public volume: Volume) {}
}
