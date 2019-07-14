"use strict";

describe("chrome.cast.media.PhotoMediaMetadata", () => {
    it("should have all properties", async () => {
        const photoMediaMetadata = new chrome.cast.media.PhotoMediaMetadata();

        expect(photoMediaMetadata.artist).toBe(undefined);
        expect(photoMediaMetadata.creationDateTime).toBe(undefined);
        expect(photoMediaMetadata.height).toBe(undefined);
        expect(photoMediaMetadata.images).toBe(undefined);
        expect(photoMediaMetadata.latitude).toBe(undefined);
        expect(photoMediaMetadata.location).toBe(undefined);
        expect(photoMediaMetadata.longitude).toBe(undefined);
        expect(photoMediaMetadata.metadataType).toBe(4);
        expect(photoMediaMetadata.title).toBe(undefined);
        expect(photoMediaMetadata.type).toBe(4);
        expect(photoMediaMetadata.width).toBe(undefined);
    });
});
