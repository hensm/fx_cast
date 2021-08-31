"use strict";

describe("chrome.cast.DialRequest", () => {
    it("should have all properties", async () => {
        const dialRequest = new chrome.cast.DialRequest();

        expect(typeof dialRequest.appName).toBe("undefined");
        expect(dialRequest.launchParameter).toBe(null);
    });

    it("should have expected assigned properties", async () => {
        const dialRequest = new chrome.cast.DialRequest(
            "testAppName",
            "testLaunchParameter"
        );

        expect(dialRequest.appName).toBe("testAppName");
        expect(dialRequest.launchParameter).toBe("testLaunchParameter");
    });
});
