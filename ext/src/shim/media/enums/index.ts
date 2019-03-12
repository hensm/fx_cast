"use strict";

export const IdleReason = {
    CANCELLED: "CANCELLED"
  , INTERRUPTED: "INTERRUPTED"
  , FINISHED: "FINISHED"
  , ERROR: "ERROR"
};

export const MediaCommand = {
    PAUSE: "pause"
  , SEEK: "seek"
  , STREAM_VOLUME: "stream_volume"
  , STREAM_MUTE: "stream_mute"
};

export const MetadataType = {
    GENERIC: 0
  , MOVIE: 1
  , TV_SHOW: 2
  , MUSIC_TRACK: 3
  , PHOTO: 4
};

export const PlayerState = {
    IDLE: "IDLE"
  , PLAYING: "PLAYING"
  , PAUSED: "PAUSED"
  , BUFFERING:  "BUFFERING"
};

export const RepeatMode = {
    OFF: "REPEAT_OFF"
  , ALL: "REPEAT_ALL"
  , SINGLE: "REPEAT_SINGLE"
  , ALL_AND_SHUFFLE: "REPEAT_ALL_AND_SHUFFLE"
};

export const ResumeState = {
    PLAYBACK_START: "PLAYBACK_START"
  , PLAYBACK_PAUSE: "PLAYBACK_PAUSE"
};

export const StreamType = {
    BUFFERED: "BUFFERED"
  , LIVE: "LIVE"
  , OTHER: "OTHER"
};

export const TextTrackEdgeType = {
    NONE: "NONE"
  , OUTLINE: "OUTLINE"
  , DROP_SHADOW: "DROP_SHADOW"
  , RAISED: "RAISED"
  , DEPRESSED: "DEPRESSED"
};

export const TextTrackFontGenericFamily = {
    SANS_SERIF: "SANS_SERIF"
  , MONOSPACED_SANS_SERIF: "MONOSPACED_SANS_SERIF"
  , SERIF: "SERIF"
  , MONOSPACED_SERIF: "MONOSPACED_SERIF"
  , CASUAL: "CASUAL"
  , CURSIVE: "CURSIVE"
  , SMALL_CAPITALS: "SMALL_CAPITALS"
};

export const TextTrackFontStyle = {
    NORMAL: "NORMAL"
  , BOLD: "BOLD"
  , BOLD_ITALIC: "BOLD_ITALIC"
  , ITALIC: "ITALIC"
};

export const TextTrackType = {
    SUBTITLES: "SUBTITLES"
  , CAPTIONS: "CAPTIONS"
  , DESCRIPTIONS: "DESCRIPTIONS"
  , CHAPTERS: "CHAPTERS"
  , METADATA: "METADATA"
};

export const TextTrackWindowType = {
    NONE: "NONE"
  , NORMAL: "NORMAL"
  , ROUNDED_CORNERS: "ROUNDED_CORNERS"
};

export const TrackType = {
    TEXT: "TEXT"
  , AUDIO: "AUDIO"
  , VIDEO: "VIDEO"
};
