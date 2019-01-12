"use strict";

describe("chrome.cast.Volume", () => {
    it("should have all properties", async () => {
        const volume = new chrome.cast.Volume();

        expect(volume.level).toBe(null);
        expect(volume.muted).toBe(null);
    });

    it("should have expected assigned properties", async () => {
        const volume = new chrome.cast.Volume(0.5, false);

        expect(volume.level).toBe(0.5);
        expect(volume.muted).toBe(false);
    });
});
