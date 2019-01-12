"use strict";

describe("chrome.cast.media.TvShowMediaMetadata", () => {
    it("should have all properties", async () => {
        const tvShowMediaMetadata = new chrome.cast.media.TvShowMediaMetadata();

        expect(tvShowMediaMetadata.episode).toBe(null);
        expect(tvShowMediaMetadata.episodeNumber).toBe(null);
        expect(tvShowMediaMetadata.episodeTitle).toBe(null);
        expect(tvShowMediaMetadata.images).toBe(null);
        expect(tvShowMediaMetadata.metadataType).toBe(2);
        expect(tvShowMediaMetadata.originalAirdate).toBe(null);
        expect(tvShowMediaMetadata.releaseYear).toBe(null);
        expect(tvShowMediaMetadata.season).toBe(null);
        expect(tvShowMediaMetadata.seasonNumber).toBe(null);
        expect(tvShowMediaMetadata.seriesTitle).toBe(null);
        expect(tvShowMediaMetadata.title).toBe(null);
        expect(tvShowMediaMetadata.type).toBe(2);
    });
});
