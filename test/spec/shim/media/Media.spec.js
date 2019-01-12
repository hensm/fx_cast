"use strict";

describe("chrome.cast.media.Media", () => {
    it("should have all properties", async () => {
        const media = new chrome.cast.media.Media();

        expect(media.activeTrackIds).toBe(null);
        expect(media.currentItemId).toBe(null);
        expect(media.customData).toBe(null);
        expect(media.idleReason).toBe(null);
        expect(media.items).toBe(null);
        expect(media.loadingItemId).toBe(null);
        expect(media.media).toBe(null);
        expect(media.mediaSessionId).toBe(undefined);
        expect(media.playbackRate).toBe(1);
        expect(media.playerState).toBe("IDLE");
        expect(media.preloadedItemId).toBe(null);
        expect(media.repeatMode).toBe("REPEAT_OFF");
        expect(media.sessionId).toBe(undefined);
        expect(media.supportedMediaCommands).toEqual([]);
        expect(media.volume).toEqual(jasmine.objectContaining({
            level: null
          , muted: null
        }));
    });

    it("should have expected assigned properties", async () => {
        const media = new chrome.cast.media.Media("__sessionId", 5);

        expect(media.mediaSessionId).toBe(5);
        expect(media.sessionId).toBe("__sessionId");
    });
});
