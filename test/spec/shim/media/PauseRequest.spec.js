"use strict";

describe("chrome.cast.media.PauseRequest", () => {
    it("should have all properties", async () => {
        const pauseRequest = new chrome.cast.media.PauseRequest();

        expect(pauseRequest.customData).toBe(null);
    });
});
