"use strict";

describe("chrome.cast.media.QueueItem", () => {
    it("should have all properties", async () => {
        const queueItem = new chrome.cast.media.QueueItem();

        expect(queueItem.activeTrackIds).toBe(null);
        expect(queueItem.autoplay).toBe(true);
        expect(queueItem.customData).toBe(null);
        expect(queueItem.itemId).toBe(null);
        expect(queueItem.media).toBe(undefined);
        expect(queueItem.playbackDuration).toBe(null);
        expect(queueItem.preloadTime).toBe(0);
        expect(queueItem.startTime).toBe(0);
    });

    it("should have expected assigned properties", async () => {
        const media = new chrome.cast.media.MediaInfo("__contentId", "video/mp4");
        const queueItem = new chrome.cast.media.QueueItem(media);

        expect(queueItem.media).toEqual(jasmine.objectContaining({
            contentId: "__contentId"
          , contentType: "video/mp4"
        }));
    });
});
