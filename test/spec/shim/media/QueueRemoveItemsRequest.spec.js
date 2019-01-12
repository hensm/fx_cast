"use strict";

describe("chrome.cast.media.QueueRemoveItemsRequest", () => {
    it("should have all properties", async () => {
        const queueRemoveItemsRequest = new chrome.cast.media.QueueRemoveItemsRequest();

        expect(queueRemoveItemsRequest.customData).toBe(null);
        expect(queueRemoveItemsRequest.itemIds).toBe(undefined);
        expect(queueRemoveItemsRequest.requestId).toBe(null);
        expect(queueRemoveItemsRequest.sessionId).toBe(null);
        expect(queueRemoveItemsRequest.type).toBe("QUEUE_REMOVE");
    });

    it("should have expected assigned properties", async () => {
        const queueRemoveItemsRequest = new chrome.cast.media.QueueRemoveItemsRequest(
                [ 5, 8, 12 ]);

        expect(queueRemoveItemsRequest.itemIds).toEqual([ 5, 8, 12 ]);
    });
});
