"use strict";

describe("chrome.cast.media.LoadRequest", () => {
    it("should have all properties", async () => {
        const loadRequest = new chrome.cast.media.LoadRequest();

        expect(loadRequest.activeTrackIds).toBe(null);
        expect(loadRequest.autoplay).toBe(true);
        expect(loadRequest.currentTime).toBe(null);
        expect(loadRequest.customData).toBe(null);
        expect(loadRequest.media).toBe(undefined);
        expect(loadRequest.requestId).toBe(0);
        expect(loadRequest.sessionId).toBe(null);
        expect(loadRequest.type).toBe("LOAD");
    });

    it("should have expected assigned properties", async () => {
        const mediaInfo = new chrome.cast.media.MediaInfo(
                "__contentId", "video/mp4");
        const loadRequest = new chrome.cast.media.LoadRequest(mediaInfo);

        expect(loadRequest.media).toEqual(jasmine.objectContaining({
            contentId: "__contentId"
          , contentType: "video/mp4"
        }));
    });
});
