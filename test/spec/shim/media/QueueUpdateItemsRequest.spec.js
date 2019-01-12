"use strict";

describe("chrome.cast.media.QueueUpdateItemsRequest", () => {
    it("should have all properties", async () => {
        const queueUpdateItemsRequest = new chrome.cast.media.QueueUpdateItemsRequest();

        expect(queueUpdateItemsRequest.customData).toBe(null);
        expect(queueUpdateItemsRequest.items).toBe(undefined);
        expect(queueUpdateItemsRequest.requestId).toBe(null);
        expect(queueUpdateItemsRequest.sessionId).toBe(null);
        expect(queueUpdateItemsRequest.type).toBe("QUEUE_UPDATE");
    });

    it("should have expected assigned properties", async () => {
        const media1 = new chrome.cast.media.MediaInfo("media1", "video/mp4");
        const media2 = new chrome.cast.media.MediaInfo("media2", "audio/mp3");

        const queueUpdateItemsRequest = new chrome.cast.media.QueueUpdateItemsRequest([
            new chrome.cast.media.QueueItem(media1)
          , new chrome.cast.media.QueueItem(media2)
        ]);

        expect(queueUpdateItemsRequest.items).toEqual([
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
