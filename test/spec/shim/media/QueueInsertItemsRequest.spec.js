"use strict";

describe("chrome.cast.media.QueueInsertItemsRequest", () => {
    it("should have all properties", async () => {
        const queueInsertItemsRequest = new chrome.cast.media.QueueInsertItemsRequest();

        expect(queueInsertItemsRequest.customData).toBe(null);
        expect(queueInsertItemsRequest.insertBefore).toBe(null);
        expect(queueInsertItemsRequest.items).toBe(undefined);
        expect(queueInsertItemsRequest.requestId).toBe(null);
        expect(queueInsertItemsRequest.sessionId).toBe(null);
        expect(queueInsertItemsRequest.type).toBe("QUEUE_INSERT");
    });

    it("should have expected assigned properties", async () => {
        const media1 = new chrome.cast.media.MediaInfo("media1", "video/mp4");
        const media2 = new chrome.cast.media.MediaInfo("media2", "audio/mp3");

        const queueInsertItemsRequest = new chrome.cast.media.QueueInsertItemsRequest([
            new chrome.cast.media.QueueItem(media1)
          , new chrome.cast.media.QueueItem(media2)
        ]);

        expect(queueInsertItemsRequest.items).toEqual([
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
