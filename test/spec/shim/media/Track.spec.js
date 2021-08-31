"use strict";

describe("chrome.cast.media.Track", () => {
    it("should have all properties", async () => {
        const track = new chrome.cast.media.Track();

        expect(track.customData).toBe(null);
        expect(track.language).toBe(null);
        expect(track.name).toBe(null);
        expect(track.subtype).toBe(null);
        expect(track.trackContentId).toBe(null);
        expect(track.trackContentType).toBe(null);
        expect(track.trackId).toBe(undefined);
        expect(track.type).toBe(undefined);
    });

    it("should have expected assigned properties", async () => {
        const track = new chrome.cast.media.Track(
            5,
            chrome.cast.media.TrackType.TEXT
        );

        expect(track.trackId).toBe(5);
        expect(track.type).toBe("TEXT");
    });
});
