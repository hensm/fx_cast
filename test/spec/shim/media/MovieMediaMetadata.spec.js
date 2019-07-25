"use strict";

describe("chrome.cast.media.MovieMediaMetadata", () => {
    it("should have all properties", async () => {
        const movieMediaMetadata = new chrome.cast.media.MovieMediaMetadata();

        expect(movieMediaMetadata.images).toBe(undefined);
        expect(movieMediaMetadata.metadataType).toBe(1);
        expect(movieMediaMetadata.releaseDate).toBe(undefined);
        expect(movieMediaMetadata.releaseYear).toBe(undefined);
        expect(movieMediaMetadata.studio).toBe(undefined);
        expect(movieMediaMetadata.subtitle).toBe(undefined);
        expect(movieMediaMetadata.title).toBe(undefined);
        expect(movieMediaMetadata.type).toBe(1);
    });
});
