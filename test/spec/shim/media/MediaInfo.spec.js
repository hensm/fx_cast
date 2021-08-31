"use strict";

describe("chrome.cast.media.MediaInfo", () => {
    it("should have all properties", async () => {
        const mediaInfo = new chrome.cast.media.MediaInfo();

        expect(mediaInfo.contentId).toBe(undefined);
        expect(mediaInfo.contentType).toBe(undefined);
        expect(mediaInfo.customData).toBe(null);
        expect(mediaInfo.duration).toBe(null);
        expect(mediaInfo.metadata).toBe(null);
        expect(mediaInfo.streamType).toBe("BUFFERED");
        expect(mediaInfo.textTrackStyle).toBe(null);
        expect(mediaInfo.tracks).toBe(null);
    });

    it("should have expected assigned properties", async () => {
        const mediaInfo = new chrome.cast.media.MediaInfo(
            "__contentId",
            "video/mp4"
        );

        expect(mediaInfo.contentId).toBe("__contentId");
        expect(mediaInfo.contentType).toBe("video/mp4");
    });
});
