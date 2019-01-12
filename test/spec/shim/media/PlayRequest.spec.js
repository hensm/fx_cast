"use strict";

describe("chrome.cast.media.PlayRequest", () => {
    it("should have all properties", async () => {
        const playRequest = new chrome.cast.media.PlayRequest();

        expect(playRequest.customData).toBe(null);
    });
});
