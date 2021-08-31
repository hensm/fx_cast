"use strict";

describe("chrome", () => {
    it("should exist", () => {
        expect(chrome).toBeDefined();
        expect(chrome.cast).toBeDefined();
        expect(chrome.cast.media).toBeDefined();
    });

    describe("chrome.cast", () => {
        it("should have all api methods", () => {
            expect(chrome.cast.addReceiverActionListener).toBeDefined();
            expect(chrome.cast.initialize).toBeDefined();
            expect(chrome.cast.logMessage).toBeDefined();
            expect(chrome.cast.precache).toBeDefined();
            expect(chrome.cast.removeReceiverActionListener).toBeDefined();
            expect(chrome.cast.requestSession).toBeDefined();
            expect(chrome.cast.requestSessionById).toBeDefined();
            expect(chrome.cast.setCustomReceivers).toBeDefined();
            expect(chrome.cast.setPageContext).toBeDefined();
            expect(chrome.cast.setReceiverDisplayStatus).toBeDefined();
            expect(chrome.cast.unescape).toBeDefined();
        });

        it("should not have private api methods", () => {
            expect(chrome.cast._requestSession).toBeUndefined();
        });

        it("should have all api classes", () => {
            expect(chrome.cast.ApiConfig).toBeDefined();
            expect(chrome.cast.DialRequest).toBeDefined();
            expect(chrome.cast.Error).toBeDefined();
            expect(chrome.cast.Image).toBeDefined();
            expect(chrome.cast.Receiver).toBeDefined();
            expect(chrome.cast.ReceiverDisplayStatus).toBeDefined();
            expect(chrome.cast.SenderApplication).toBeDefined();
            expect(chrome.cast.Session).toBeDefined();
            expect(chrome.cast.SessionRequest).toBeDefined();
            expect(chrome.cast.Timeout).toBeDefined();
            expect(chrome.cast.Volume).toBeDefined();
        });

        it("should have all api enums", () => {
            expect(chrome.cast.AutoJoinPolicy).toEqual(
                jasmine.objectContaining({
                    CUSTOM_CONTROLLER_SCOPED: "custom_controller_scoped",
                    TAB_AND_ORIGIN_SCOPED: "tab_and_origin_scoped",
                    ORIGIN_SCOPED: "origin_scoped",
                    PAGE_SCOPED: "page_scoped"
                })
            );

            expect(chrome.cast.Capability).toEqual(
                jasmine.objectContaining({
                    VIDEO_OUT: "video_out",
                    AUDIO_OUT: "audio_out",
                    VIDEO_IN: "video_in",
                    AUDIO_IN: "audio_in",
                    MULTIZONE_GROUP: "multizone_group"
                })
            );

            expect(chrome.cast.DefaultActionPolicy).toEqual(
                jasmine.objectContaining({
                    CREATE_SESSION: "create_session",
                    CAST_THIS_TAB: "cast_this_tab"
                })
            );

            expect(chrome.cast.DialAppState).toEqual(
                jasmine.objectContaining({
                    RUNNING: "running",
                    STOPPED: "stopped",
                    ERROR: "error"
                })
            );

            expect(chrome.cast.ErrorCode).toEqual(
                jasmine.objectContaining({
                    CANCEL: "cancel",
                    TIMEOUT: "timeout",
                    API_NOT_INITIALIZED: "api_not_initialized",
                    INVALID_PARAMETER: "invalid_parameter",
                    EXTENSION_NOT_COMPATIBLE: "extension_not_compatible",
                    EXTENSION_MISSING: "extension_missing",
                    RECEIVER_UNAVAILABLE: "receiver_unavailable",
                    SESSION_ERROR: "session_error",
                    CHANNEL_ERROR: "channel_error",
                    LOAD_MEDIA_FAILED: "load_media_failed"
                })
            );

            expect(chrome.cast.ReceiverAction).toEqual(
                jasmine.objectContaining({
                    CAST: "cast",
                    STOP: "stop"
                })
            );

            expect(chrome.cast.ReceiverAvailability).toEqual(
                jasmine.objectContaining({
                    AVAILABLE: "available",
                    UNAVAILABLE: "unavailable"
                })
            );

            expect(chrome.cast.ReceiverType).toEqual(
                jasmine.objectContaining({
                    CAST: "cast",
                    DIAL: "dial",
                    HANGOUT: "hangout",
                    CUSTOM: "custom"
                })
            );

            expect(chrome.cast.SenderPlatform).toEqual(
                jasmine.objectContaining({
                    CHROME: "chrome",
                    IOS: "ios",
                    ANDROID: "android"
                })
            );

            expect(chrome.cast.SessionStatus).toEqual(
                jasmine.objectContaining({
                    CONNECTED: "connected",
                    DISCONNECTED: "disconnected",
                    STOPPED: "stopped"
                })
            );

            expect(chrome.cast.VolumeControlType).toEqual(
                jasmine.objectContaining({
                    ATTENUATION: "attenuation",
                    FIXED: "fixed",
                    MASTER: "master"
                })
            );
        });
    });

    describe("chrome.cast.media", () => {
        it("should have all api classes", () => {
            expect(chrome.cast.media.EditTracksInfoRequest).toBeDefined();
            expect(chrome.cast.media.GenericMediaMetadata).toBeDefined();
            expect(chrome.cast.media.GetStatusRequest).toBeDefined();
            expect(chrome.cast.media.LoadRequest).toBeDefined();
            expect(chrome.cast.media.Media).toBeDefined();
            expect(chrome.cast.media.MediaInfo).toBeDefined();
            expect(chrome.cast.media.MovieMediaMetadata).toBeDefined();
            expect(chrome.cast.media.MusicTrackMediaMetadata).toBeDefined();
            expect(chrome.cast.media.PauseRequest).toBeDefined();
            expect(chrome.cast.media.PhotoMediaMetadata).toBeDefined();
            expect(chrome.cast.media.PlayRequest).toBeDefined();
            expect(chrome.cast.media.QueueInsertItemsRequest).toBeDefined();
            expect(chrome.cast.media.QueueItem).toBeDefined();
            expect(chrome.cast.media.QueueLoadRequest).toBeDefined();
            expect(chrome.cast.media.QueueRemoveItemsRequest).toBeDefined();
            expect(chrome.cast.media.QueueReorderItemsRequest).toBeDefined();
            expect(chrome.cast.media.QueueUpdateItemsRequest).toBeDefined();
            expect(chrome.cast.media.SeekRequest).toBeDefined();
            expect(chrome.cast.media.StopRequest).toBeDefined();
            expect(chrome.cast.media.TextTrackStyle).toBeDefined();
            expect(chrome.cast.media.Track).toBeDefined();
            expect(chrome.cast.media.TvShowMediaMetadata).toBeDefined();
            expect(chrome.cast.media.VolumeRequest).toBeDefined();
        });

        it("should have all api enums", () => {
            expect(chrome.cast.media.IdleReason).toEqual(
                jasmine.objectContaining({
                    CANCELLED: "CANCELLED",
                    INTERRUPTED: "INTERRUPTED",
                    FINISHED: "FINISHED",
                    ERROR: "ERROR"
                })
            );
            expect(chrome.cast.media.MediaCommand).toEqual(
                jasmine.objectContaining({
                    PAUSE: "pause",
                    SEEK: "seek",
                    STREAM_VOLUME: "stream_volume",
                    STREAM_MUTE: "stream_mute"
                })
            );
            expect(chrome.cast.media.MetadataType).toEqual(
                jasmine.objectContaining({
                    GENERIC: 0,
                    MOVIE: 1,
                    TV_SHOW: 2,
                    MUSIC_TRACK: 3,
                    PHOTO: 4
                })
            );
            expect(chrome.cast.media.PlayerState).toEqual(
                jasmine.objectContaining({
                    IDLE: "IDLE",
                    PLAYING: "PLAYING",
                    PAUSED: "PAUSED",
                    BUFFERING: "BUFFERING"
                })
            );
            expect(chrome.cast.media.RepeatMode).toEqual(
                jasmine.objectContaining({
                    OFF: "REPEAT_OFF",
                    ALL: "REPEAT_ALL",
                    SINGLE: "REPEAT_SINGLE",
                    ALL_AND_SHUFFLE: "REPEAT_ALL_AND_SHUFFLE"
                })
            );
            expect(chrome.cast.media.ResumeState).toEqual(
                jasmine.objectContaining({
                    PLAYBACK_START: "PLAYBACK_START",
                    PLAYBACK_PAUSE: "PLAYBACK_PAUSE"
                })
            );
            expect(chrome.cast.media.StreamType).toEqual(
                jasmine.objectContaining({
                    BUFFERED: "BUFFERED",
                    LIVE: "LIVE",
                    OTHER: "OTHER"
                })
            );
            expect(chrome.cast.media.TextTrackEdgeType).toEqual(
                jasmine.objectContaining({
                    NONE: "NONE",
                    OUTLINE: "OUTLINE",
                    DROP_SHADOW: "DROP_SHADOW",
                    RAISED: "RAISED",
                    DEPRESSED: "DEPRESSED"
                })
            );
            expect(chrome.cast.media.TextTrackFontGenericFamily).toEqual(
                jasmine.objectContaining({
                    SANS_SERIF: "SANS_SERIF",
                    MONOSPACED_SANS_SERIF: "MONOSPACED_SANS_SERIF",
                    SERIF: "SERIF",
                    MONOSPACED_SERIF: "MONOSPACED_SERIF",
                    CASUAL: "CASUAL",
                    CURSIVE: "CURSIVE",
                    SMALL_CAPITALS: "SMALL_CAPITALS"
                })
            );
            expect(chrome.cast.media.TextTrackFontStyle).toEqual(
                jasmine.objectContaining({
                    NORMAL: "NORMAL",
                    BOLD: "BOLD",
                    BOLD_ITALIC: "BOLD_ITALIC",
                    ITALIC: "ITALIC"
                })
            );
            expect(chrome.cast.media.TextTrackType).toEqual(
                jasmine.objectContaining({
                    SUBTITLES: "SUBTITLES",
                    CAPTIONS: "CAPTIONS",
                    DESCRIPTIONS: "DESCRIPTIONS",
                    CHAPTERS: "CHAPTERS",
                    METADATA: "METADATA"
                })
            );
            expect(chrome.cast.media.TextTrackWindowType).toEqual(
                jasmine.objectContaining({
                    NONE: "NONE",
                    NORMAL: "NORMAL",
                    ROUNDED_CORNERS: "ROUNDED_CORNERS"
                })
            );
            expect(chrome.cast.media.TrackType).toEqual(
                jasmine.objectContaining({
                    TEXT: "TEXT",
                    AUDIO: "AUDIO",
                    VIDEO: "VIDEO"
                })
            );
        });

        describe("chrome.cast.media.timeout", () => {
            it("should have all properties", () => {
                expect(chrome.cast.media.timeout.editTracksInfo).toBe(0);
                expect(chrome.cast.media.timeout.getStatus).toBe(0);
                expect(chrome.cast.media.timeout.load).toBe(0);
                expect(chrome.cast.media.timeout.pause).toBe(0);
                expect(chrome.cast.media.timeout.play).toBe(0);
                expect(chrome.cast.media.timeout.queue).toBe(0);
                expect(chrome.cast.media.timeout.seek).toBe(0);
                expect(chrome.cast.media.timeout.setVolume).toBe(0);
                expect(chrome.cast.media.timeout.stop).toBe(0);
            });
        });
    });
});
