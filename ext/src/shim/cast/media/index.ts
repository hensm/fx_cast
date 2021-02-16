"use strict";

import AudiobookChapterMediaMetadata from "./classes/AudiobookChapterMediaMetadata";
import AudiobookContainerMetadata from "./classes/AudiobookContainerMetadata";
import Break from "./classes/Break";
import BreakClip from "./classes/BreakClip";
import BreakStatus from "./classes/BreakStatus";
import ContainerMetadata from "./classes/ContainerMetadata";
import EditTracksInfoRequest from "./classes/EditTracksInfoRequest";
import GenericMediaMetadata from "./classes/GenericMediaMetadata";
import GetStatusRequest from "./classes/GetStatusRequest";
import LiveSeekableRange from "./classes/LiveSeekableRange";
import LoadRequest from "./classes/LoadRequest";
import Media from "./classes/Media";
import MediaInfo from "./classes/MediaInfo";
import MediaMetadata from "./classes/MediaMetadata";
import MovieMediaMetadata from "./classes/MovieMediaMetadata";
import MusicTrackMediaMetadata from "./classes/MusicTrackMediaMetadata";
import PauseRequest from "./classes/PauseRequest";
import PhotoMediaMetadata from "./classes/PhotoMediaMetadata";
import PlayRequest from "./classes/PlayRequest";
import QueueData from "./classes/QueueData";
import QueueInsertItemsRequest from "./classes/QueueInsertItemsRequest";
import QueueItem from "./classes/QueueItem";
import QueueLoadRequest from "./classes/QueueLoadRequest";
import QueueRemoveItemsRequest from "./classes/QueueRemoveItemsRequest";
import QueueReorderItemsRequest from "./classes/QueueReorderItemsRequest";
import QueueSetPropertiesRequest from "./classes/QueueSetPropertiesRequest";
import QueueUpdateItemsRequest from "./classes/QueueUpdateItemsRequest";
import SeekRequest from "./classes/SeekRequest";
import StopRequest from "./classes/StopRequest";
import TextTrackStyle from "./classes/TextTrackStyle";
import Track from "./classes/Track";
import TvShowMediaMetadata from "./classes/TvShowMediaMetadata";
import UserActionState from "./classes/QueueItem";
import VastAdsRequest from "./classes/VastAdsRequest";
import VideoInformation from "./classes/VideoInformation";
import VolumeRequest from "./classes/VolumeRequest";

import { ContainerType
       , HdrType
       , HlsSegmentFormat
       , HlsVideoSegmentFormat
       , IdleReason
       , MediaCommand
       , MetadataType
       , PlayerState
       , QueueType
       , RepeatMode
       , ResumeState
       , StreamType
       , TextTrackEdgeType
       , TextTrackFontGenericFamily
       , TextTrackFontStyle
       , TextTrackType
       , TextTrackWindowType
       , TrackType
       , UserAction } from "./enums";


export {
    // Enums
    ContainerType, HdrType, HlsSegmentFormat, HlsVideoSegmentFormat, IdleReason
  , MediaCommand, MetadataType, PlayerState, QueueType, RepeatMode, ResumeState
  , StreamType, TextTrackEdgeType, TextTrackFontGenericFamily
  , TextTrackFontStyle, TextTrackType, TextTrackWindowType, TrackType
  , UserAction

    // Classes
  , AudiobookChapterMediaMetadata, AudiobookContainerMetadata, Break, BreakClip
  , BreakStatus, ContainerMetadata, EditTracksInfoRequest, GenericMediaMetadata
  , GetStatusRequest, LiveSeekableRange, LoadRequest, Media, MediaInfo
  , MediaMetadata, MovieMediaMetadata, MusicTrackMediaMetadata, PauseRequest
  , PhotoMediaMetadata, PlayRequest, QueueInsertItemsRequest, QueueData
  , QueueItem, QueueLoadRequest, QueueRemoveItemsRequest
  , QueueReorderItemsRequest, QueueSetPropertiesRequest, QueueUpdateItemsRequest
  , SeekRequest, StopRequest, TextTrackStyle, Track, TvShowMediaMetadata
  , UserActionState, VastAdsRequest, VideoInformation, VolumeRequest
};

export const timeout = {
    editTracksInfo: 0
  , getStatus: 0
  , load: 0
  , pause: 0
  , play: 0
  , queue: 0
  , seek: 0
  , setVolume: 0
  , stop: 0
};

export const DEFAULT_MEDIA_RECEIVER_APP_ID = "CC1AD845";
