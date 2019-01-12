"use strict";

describe("chrome.cast.media.SeekRequest", () => {
    it("should have all properties", async () => {
        const seekRequest = new chrome.cast.media.SeekRequest();

        expect(seekRequest.currentTime).toBe(null);
        expect(seekRequest.customData).toBe(null);
        expect(seekRequest.resumeState).toBe(null);
    });
});
