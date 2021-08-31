"use strict";

describe("chrome.cast.media.QueueSetPropertiesRequest", () => {
    it("should have all properties", async () => {
        const queueSetPropertiesRequest =
            new chrome.cast.media.QueueSetPropertiesRequest();

        expect(queueSetPropertiesRequest.customData).toBe(null);
        expect(queueSetPropertiesRequest.repeatMode).toBe(null);
        expect(queueSetPropertiesRequest.requestId).toBe(null);
        expect(queueSetPropertiesRequest.sessionId).toBe(null);
        expect(queueSetPropertiesRequest.type).toBe("QUEUE_UPDATE");
    });
});
