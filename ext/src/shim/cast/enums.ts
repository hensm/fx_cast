"use strict";

export const AutoJoinPolicy = {
    TAB_AND_ORIGIN_SCOPED: "tab_and_origin_scoped"
  , ORIGIN_SCOPED: "origin_scoped"
  , PAGE_SCOPED: "page_scoped"
  , CUSTOM_CONTROLLER_SCOPED: "custom_controller_scoped"
};

export const Capability = {
    VIDEO_OUT: "video_out"
  , AUDIO_OUT: "audio_out"
  , VIDEO_IN: "video_in"
  , AUDIO_IN: "audio_in"
  , MULTIZONE_GROUP: "multizone_group"
};

export const DefaultActionPolicy = {
    CREATE_SESSION: "create_session"
  , CAST_THIS_TAB: "cast_this_tab"
};

export const DialAppState = {
    RUNNING: "running"
  , STOPPED: "stopped"
  , ERROR: "error"
};

export const ErrorCode = {
    CANCEL: "cancel"
  , TIMEOUT: "timeout"
  , API_NOT_INITIALIZED: "api_not_initialized"
  , INVALID_PARAMETER: "invalid_parameter"
  , EXTENSION_NOT_COMPATIBLE: "extension_not_compatible"
  , EXTENSION_MISSING: "extension_missing"
  , RECEIVER_UNAVAILABLE: "receiver_unavailable"
  , SESSION_ERROR: "session_error"
  , CHANNEL_ERROR: "channel_error"
  , LOAD_MEDIA_FAILED: "load_media_failed"
};

export const ReceiverAction = {
    CAST: "cast"
  , STOP: "stop"
};

export const ReceiverAvailability = {
    AVAILABLE: "available"
  , UNAVAILABLE: "unavailable"
};

export const ReceiverType = {
    CAST: "cast"
  , DIAL: "dial"
  , HANGOUT: "hangout"
  , CUSTOM: "custom"
};

export const SenderPlatform = {
    CHROME: "chrome"
  , IOS: "ios"
  , ANDROID: "android"
};

export const SessionStatus = {
    CONNECTED: "connected"
  , DISCONNECTED: "disconnected"
  , STOPPED: "stopped"
};

export const VolumeControlType = {
    ATTENUATION: "attenuation"
  , FIXED: "fixed"
  , MASTER: "master"
};
