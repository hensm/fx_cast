"use strict";

describe("chrome.cast.media.MusicTrackMediaMetadata", () => {
    it("should have all properties", async () => {
        const musicTrackMediaMetadata = new chrome.cast.media.MusicTrackMediaMetadata();

        expect(musicTrackMediaMetadata.albumArtist).toBe(null);
        expect(musicTrackMediaMetadata.albumName).toBe(null);
        expect(musicTrackMediaMetadata.artist).toBe(null);
        expect(musicTrackMediaMetadata.artistName).toBe(null);
        expect(musicTrackMediaMetadata.composer).toBe(null);
        expect(musicTrackMediaMetadata.discNumber).toBe(null);
        expect(musicTrackMediaMetadata.images).toBe(null);
        expect(musicTrackMediaMetadata.metadataType).toBe(3);
        expect(musicTrackMediaMetadata.releaseDate).toBe(null);
        expect(musicTrackMediaMetadata.releaseYear).toBe(null);
        expect(musicTrackMediaMetadata.songName).toBe(null);
        expect(musicTrackMediaMetadata.title).toBe(null);
        expect(musicTrackMediaMetadata.trackNumber).toBe(null);
        expect(musicTrackMediaMetadata.type).toBe(3);
    });
});
