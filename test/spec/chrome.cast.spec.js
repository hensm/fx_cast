"use strict";

const sharedDriver = require("../sharedDriver");

describe("chrome.cast", () => {
    let driver;
    let chrome;

    beforeAll(async () => {
        driver = await sharedDriver();
        chrome = await driver.executeScript(() => {
            return chrome;
        });
    });


    it("should have all api functions", async () => {
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

    it("should have all api classes", async () => {
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

    it("should have all api enums", async () => {
        expect(chrome.cast.AutoJoinPolicy).toEqual(jasmine.objectContaining(        {
            CUSTOM_CONTROLLER_SCOPED: "custom_controller_scoped"
          , TAB_AND_ORIGIN_SCOPED: "tab_and_origin_scoped"
          , ORIGIN_SCOPED: "origin_scoped"
          , PAGE_SCOPED: "page_scoped"
        }));

        expect(chrome.cast.Capability).toEqual(jasmine.objectContaining({
            VIDEO_OUT: "video_out"
          , AUDIO_OUT: "audio_out"
          , VIDEO_IN: "video_in"
          , AUDIO_IN: "audio_in"
          , MULTIZONE_GROUP: "multizone_group"
        }));

        expect(chrome.cast.DefaultActionPolicy).toEqual(jasmine.objectContaining({
            CREATE_SESSION: "create_session"
          , CAST_THIS_TAB: "cast_this_tab"
        }));

        expect(chrome.cast.DialAppState).toEqual(jasmine.objectContaining({
            RUNNING: "running"
          , STOPPED: "stopped"
          , ERROR: "error"
        }));

        expect(chrome.cast.ErrorCode).toEqual(jasmine.objectContaining({
            CANCEL: "cancel"
          , TIMEOUT: "timeout"
          , API_NOT_INITIALIZED: "api_not_initialized"
          , INVALID_PARAMETER: "invalid_parameter"
          , EXTENSION_NOT_COMPATIBLE: "extension_not_compatible"
          , EXTENSION_MISSING:  "extension_missing"
          , RECEIVER_UNAVAILABLE: "receiver_unavailable"
          , SESSION_ERROR: "session_error"
          , CHANNEL_ERROR: "channel_error"
          , LOAD_MEDIA_FAILED: "load_media_failed"
        }));

        expect(chrome.cast.ReceiverAction).toEqual(jasmine.objectContaining({
            CAST: "cast"
          , STOP: "stop"
        }));

        expect(chrome.cast.ReceiverAvailability).toEqual(jasmine.objectContaining({
            AVAILABLE: "available"
          , UNAVAILABLE: "unavailable"
        }));

        expect(chrome.cast.ReceiverType).toEqual(jasmine.objectContaining({
            CAST: "cast"
          , DIAL: "dial"
          , HANGOUT: "hangout"
          , CUSTOM: "custom"
        }));

        expect(chrome.cast.SenderPlatform).toEqual(jasmine.objectContaining({
            CHROME: "chrome"
          , IOS: "ios"
          , ANDROID: "android"
        }));

        expect(chrome.cast.SessionStatus).toEqual(jasmine.objectContaining({
            CONNECTED: "connected"
          , DISCONNECTED: "disconnected"
          , STOPPED: "stopped"
        }));

        expect(chrome.cast.VolumeControlType).toEqual(jasmine.objectContaining({
            ATTENUATION: "attenuation"
          , FIXED: "fixed"
          , MASTER: "master"
        }));
    });
});