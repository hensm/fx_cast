"use strict";

describe("chrome.cast.media.GenericMediaMetadata", () => {
    it("should have all properties", async () => {
        const genericMediaMetadata =
            new chrome.cast.media.GenericMediaMetadata();

        expect(genericMediaMetadata.images).toBe(undefined);
        expect(genericMediaMetadata.metadataType).toBe(0);
        expect(genericMediaMetadata.releaseDate).toBe(undefined);
        expect(genericMediaMetadata.releaseYear).toBe(undefined);
        expect(genericMediaMetadata.subtitle).toBe(undefined);
        expect(genericMediaMetadata.title).toBe(undefined);
        expect(genericMediaMetadata.type).toBe(0);
    });
});
