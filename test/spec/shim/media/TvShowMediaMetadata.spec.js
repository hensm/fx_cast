"use strict";

describe("chrome.cast.media.TvShowMediaMetadata", () => {
    it("should have all properties", async () => {
        const tvShowMediaMetadata = new chrome.cast.media.TvShowMediaMetadata();

        expect(tvShowMediaMetadata.episode).toBe(undefined);
        expect(tvShowMediaMetadata.episodeNumber).toBe(undefined);
        expect(tvShowMediaMetadata.episodeTitle).toBe(undefined);
        expect(tvShowMediaMetadata.images).toBe(undefined);
        expect(tvShowMediaMetadata.metadataType).toBe(2);
        expect(tvShowMediaMetadata.originalAirdate).toBe(undefined);
        expect(tvShowMediaMetadata.releaseYear).toBe(undefined);
        expect(tvShowMediaMetadata.season).toBe(undefined);
        expect(tvShowMediaMetadata.seasonNumber).toBe(undefined);
        expect(tvShowMediaMetadata.seriesTitle).toBe(undefined);
        expect(tvShowMediaMetadata.title).toBe(undefined);
        expect(tvShowMediaMetadata.type).toBe(2);
    });
});
