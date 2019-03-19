"use strict";

import EditTracksInfoRequest from "./classes/EditTracksInfoRequest";
import GenericMediaMetadata from "./classes/GenericMediaMetadata";
import GetStatusRequest from "./classes/GetStatusRequest";
import LoadRequest from "./classes/LoadRequest";
import Media from "./classes/Media";
import MediaInfo from "./classes/MediaInfo";
import MovieMediaMetadata from "./classes/MovieMediaMetadata";
import MusicTrackMediaMetadata from "./classes/MusicTrackMediaMetadata";
import PauseRequest from "./classes/PauseRequest";
import PhotoMediaMetadata from "./classes/PhotoMediaMetadata";
import PlayRequest from "./classes/PlayRequest";
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
import VolumeRequest from "./classes/VolumeRequest";

import { IdleReason
       , MediaCommand
       , MetadataType
       , PlayerState
       , RepeatMode
       , ResumeState
       , StreamType
       , TextTrackEdgeType
       , TextTrackFontGenericFamily
       , TextTrackFontStyle
       , TextTrackType
       , TextTrackWindowType
       , TrackType } from "./enums";


export {
    // Enums
    IdleReason, MediaCommand, MetadataType, PlayerState
  , RepeatMode, ResumeState, StreamType, TextTrackEdgeType
  , TextTrackFontGenericFamily, TextTrackFontStyle, TextTrackType
  , TextTrackWindowType, TrackType

    // Classes
  , EditTracksInfoRequest, GenericMediaMetadata, GetStatusRequest, LoadRequest
  , Media, MediaInfo, MovieMediaMetadata, MusicTrackMediaMetadata
  , PauseRequest, PhotoMediaMetadata, PlayRequest, QueueInsertItemsRequest
  , QueueItem, QueueLoadRequest, QueueRemoveItemsRequest
  , QueueReorderItemsRequest, QueueSetPropertiesRequest, QueueUpdateItemsRequest
  , SeekRequest, StopRequest, TextTrackStyle, Track
  , TvShowMediaMetadata, VolumeRequest
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
