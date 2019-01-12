"use strict";

describe("chrome.cast.media.PhotoMediaMetadata", () => {
    it("should have all properties", async () => {
        const photoMediaMetadata = new chrome.cast.media.PhotoMediaMetadata();

        expect(photoMediaMetadata.artist).toBe(null);
        expect(photoMediaMetadata.creationDateTime).toBe(null);
        expect(photoMediaMetadata.height).toBe(null);
        expect(photoMediaMetadata.images).toBe(null);
        expect(photoMediaMetadata.latitude).toBe(null);
        expect(photoMediaMetadata.location).toBe(null);
        expect(photoMediaMetadata.longitude).toBe(null);
        expect(photoMediaMetadata.metadataType).toBe(4);
        expect(photoMediaMetadata.title).toBe(null);
        expect(photoMediaMetadata.type).toBe(4);
        expect(photoMediaMetadata.width).toBe(null);
    });
});
