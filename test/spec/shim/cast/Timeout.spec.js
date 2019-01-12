"use strict";

describe("chrome.cast.Timeout", () => {
    it("should have all properties", async () => {
        const timeout = new chrome.cast.Timeout();

        expect(timeout.leaveSession).toBe(3000);
        expect(timeout.requestSession).toBe(60000);
        expect(timeout.sendCustomMessage).toBe(3000);
        expect(timeout.setReceiverVolume).toBe(3000);
        expect(timeout.stopSession).toBe(3000);
    });
});
