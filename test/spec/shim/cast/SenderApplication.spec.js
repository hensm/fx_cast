"use strict";

describe("chrome.cast.SenderApplication", () => {
    it("should have all properties", async () => {
        const senderApplication = new chrome.cast.SenderApplication();

        expect(senderApplication.platform).toBe(undefined);
        expect(senderApplication.url).toBe(null);
        expect(senderApplication.packageId).toBe(null);
    });

    it("should have expected assigned properties", async () => {
        const senderApplication = new chrome.cast.SenderApplication(
            chrome.cast.SenderPlatform.CHROME
        );

        expect(senderApplication.platform).toBe("chrome");
    });
});
