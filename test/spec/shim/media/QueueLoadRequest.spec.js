"use strict";

describe("chrome.cast.media.QueueLoadRequest", () => {
    it("should have all properties", async () => {
        const queueLoadRequest = new chrome.cast.media.QueueLoadRequest();

        expect(queueLoadRequest.customData).toBe(null);
        expect(queueLoadRequest.items).toBe(undefined);
        expect(queueLoadRequest.repeatMode).toBe("REPEAT_OFF");
        expect(queueLoadRequest.requestId).toBe(null);
        expect(queueLoadRequest.sessionId).toBe(null);
        expect(queueLoadRequest.startIndex).toBe(0);
        expect(queueLoadRequest.type).toBe("QUEUE_LOAD");
    });

    it("should have expected assigned properties", async () => {
        const media1 = new chrome.cast.media.MediaInfo("media1", "video/mp4");
        const media2 = new chrome.cast.media.MediaInfo("media2", "audio/mp3");

        const queueLoadRequest = new chrome.cast.media.QueueLoadRequest([
            new chrome.cast.media.QueueItem(media1)
          , new chrome.cast.media.QueueItem(media2)
        ]);

        expect(queueLoadRequest.items).toEqual([
            jasmine.objectContaining({ media: jasmine.objectContaining({
                contentId: "media1"
              , contentType: "video/mp4"
            })})
          , jasmine.objectContaining({ media: jasmine.objectContaining({
                contentId: "media2"
              , contentType: "audio/mp3"
            })})
        ]);
    });
});
