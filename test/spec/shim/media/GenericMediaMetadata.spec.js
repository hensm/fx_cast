"use strict";

describe("chrome.cast.media.GenericMediaMetadata", () => {
    it("should have all properties", async () => {
        const genericMediaMetadata = new chrome.cast.media.GenericMediaMetadata();

        expect(genericMediaMetadata.images).toBe(null);
        expect(genericMediaMetadata.metadataType).toBe(0);
        expect(genericMediaMetadata.releaseDate).toBe(null);
        expect(genericMediaMetadata.releaseYear).toBe(null);
        expect(genericMediaMetadata.subtitle).toBe(null);
        expect(genericMediaMetadata.title).toBe(null);
        expect(genericMediaMetadata.type).toBe(0);
    });
});
