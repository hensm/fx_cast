"use strict";

describe("chrome.cast.Image", () => {
    it("should have all properties", async () => {
        const image = new chrome.cast.Image();

        expect(typeof image.url).toBe("undefined");
        expect(image.height).toBe(null);
        expect(image.width).toBe(null);
    });

    it("should have expected assigned properties", async () => {
        const image = new chrome.cast.Image("http://example.com");

        expect(image.url).toBe("http://example.com");
    });
});
