"use strict";

describe("chrome.cast.media.QueueReorderItemsRequest", () => {
    it("should have all properties", async () => {
        const queueReorderItemsRequest = new chrome.cast.media.QueueReorderItemsRequest();

        expect(queueReorderItemsRequest.customData).toBe(null);
        expect(queueReorderItemsRequest.insertBefore).toBe(null);
        expect(queueReorderItemsRequest.itemIds).toBe(undefined);
        expect(queueReorderItemsRequest.requestId).toBe(null);
        expect(queueReorderItemsRequest.sessionId).toBe(null);
        expect(queueReorderItemsRequest.type).toBe("QUEUE_REORDER");
    });

    it("should have expected assigned properties", async () => {
        const queueReorderItemsRequest = new chrome.cast.media.QueueReorderItemsRequest(
                [ 5, 8, 12 ]);

        expect(queueReorderItemsRequest.itemIds).toEqual([ 5, 8, 12 ]);
    });
});
