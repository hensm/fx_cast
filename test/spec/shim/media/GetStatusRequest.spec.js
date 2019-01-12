"use strict";

describe("chrome.cast.media.GetStatusRequest", () => {
    it("should have all properties", async () => {
        const getStatusRequest = new chrome.cast.media.GetStatusRequest();

        expect(getStatusRequest.customData).toBe(null);
    });
});
