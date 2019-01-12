"use strict";

describe("chrome.cast.media.VolumeRequest", () => {
    it("should have all properties", async () => {
        const volumeRequest = new chrome.cast.media.VolumeRequest();

        expect(volumeRequest.customData).toBe(null);
        expect(volumeRequest.volume).toBe(undefined);
    });

    it("should have expected assigned properties", async () => {
        const volume = new chrome.cast.Volume(0.5, false);
        const volumeRequest = new chrome.cast.media.VolumeRequest(volume);

        expect(volumeRequest.volume).toEqual(jasmine.objectContaining({
            level: 0.5
          , muted: false
        }));
    });
});
