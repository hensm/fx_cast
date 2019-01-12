"use strict";

describe("chrome.cast.media.StopRequest", () => {
    it("should have all properties", async () => {
        const stopRequest = new chrome.cast.media.StopRequest();

        expect(stopRequest.customData).toBe(null);
    });
});
