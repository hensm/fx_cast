"use strict";

describe("chrome.cast.ReceiverDisplayStatus", () => {
    it("should have all properties", async () => {
        const receiverDisplayStatus = new chrome.cast.ReceiverDisplayStatus();

        expect(typeof receiverDisplayStatus.appImages).toBe("undefined");
        expect(typeof receiverDisplayStatus.statusText).toBe("undefined");
        expect(receiverDisplayStatus.showStop).toBe(null);
    });

    it("should have expected assigned properties", async () => {
        const receiverDisplayStatus = new chrome.cast.ReceiverDisplayStatus(
            "testStatusText",
            [
                new chrome.cast.Image("http://example.com/1"),
                new chrome.cast.Image("http://example.com/2")
            ]
        );

        expect(receiverDisplayStatus.statusText).toBe("testStatusText");
        expect(receiverDisplayStatus.appImages).toContain(
            jasmine.objectContaining({
                url: "http://example.com/1",
                height: null,
                width: null
            })
        );
        expect(receiverDisplayStatus.appImages).toContain(
            jasmine.objectContaining({
                url: "http://example.com/2",
                height: null,
                width: null
            })
        );
    });
});
