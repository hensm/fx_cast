"use strict";

describe("chrome.cast.media.MusicTrackMediaMetadata", () => {
    it("should have all properties", async () => {
        const musicTrackMediaMetadata = new chrome.cast.media.MusicTrackMediaMetadata();

        expect(musicTrackMediaMetadata.albumArtist).toBe(undefined);
        expect(musicTrackMediaMetadata.albumName).toBe(undefined);
        expect(musicTrackMediaMetadata.artist).toBe(undefined);
        expect(musicTrackMediaMetadata.artistName).toBe(undefined);
        expect(musicTrackMediaMetadata.composer).toBe(undefined);
        expect(musicTrackMediaMetadata.discNumber).toBe(undefined);
        expect(musicTrackMediaMetadata.images).toBe(undefined);
        expect(musicTrackMediaMetadata.metadataType).toBe(3);
        expect(musicTrackMediaMetadata.releaseDate).toBe(undefined);
        expect(musicTrackMediaMetadata.releaseYear).toBe(undefined);
        expect(musicTrackMediaMetadata.songName).toBe(undefined);
        expect(musicTrackMediaMetadata.title).toBe(undefined);
        expect(musicTrackMediaMetadata.trackNumber).toBe(undefined);
        expect(musicTrackMediaMetadata.type).toBe(3);
    });
});
