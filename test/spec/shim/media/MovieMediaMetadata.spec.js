"use strict";

describe("chrome.cast.media.MovieMediaMetadata", () => {
    it("should have all properties", async () => {
        const movieMediaMetadata = new chrome.cast.media.MovieMediaMetadata();

        expect(movieMediaMetadata.images).toBe(null);
        expect(movieMediaMetadata.metadataType).toBe(1);
        expect(movieMediaMetadata.releaseDate).toBe(null);
        expect(movieMediaMetadata.releaseYear).toBe(null);
        expect(movieMediaMetadata.studio).toBe(null);
        expect(movieMediaMetadata.subtitle).toBe(null);
        expect(movieMediaMetadata.title).toBe(null);
        expect(movieMediaMetadata.type).toBe(1);
    });
});
