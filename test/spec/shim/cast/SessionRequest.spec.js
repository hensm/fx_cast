"use strict";

describe("chrome.cast.SessionRequest", () => {
    it("should have all properties", async () => {
        const sessionRequest = new chrome.cast.SessionRequest();

        expect(sessionRequest.appId).toBe(undefined);
        expect(sessionRequest.capabilities).toEqual([ "video_out", "audio_out" ]);
        expect(sessionRequest.dialRequest).toBe(null);
        expect(sessionRequest.language).toBe(null);
        expect(sessionRequest.requestSessionTimeout).toBe(60000);
    });

    it("should have expected assigned properties", async () => {
        const sessionRequest = new chrome.cast.SessionRequest(
                "__appId"
              , [ chrome.cast.Capability.VIDEO_OUT
                , chrome.cast.Capability.AUDIO_IN ]
              , 5000);

        expect(sessionRequest.appId).toBe("__appId");
        expect(sessionRequest.capabilities).toEqual([ "video_out", "audio_in" ]);
        expect(sessionRequest.requestSessionTimeout).toBe(5000);
    });
});
