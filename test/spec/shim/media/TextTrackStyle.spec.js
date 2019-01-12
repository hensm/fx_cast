"use strict";

describe("chrome.cast.media.TextTrackStyle", () => {
    it("should have all properties", async () => {
        const textTrackStyle = new chrome.cast.media.TextTrackStyle();

        expect(textTrackStyle.backgroundColor).toBe(null);
        expect(textTrackStyle.customData).toBe(null);
        expect(textTrackStyle.edgeColor).toBe(null);
        expect(textTrackStyle.edgeType).toBe(null);
        expect(textTrackStyle.fontFamily).toBe(null);
        expect(textTrackStyle.fontGenericFamily).toBe(null);
        expect(textTrackStyle.fontScale).toBe(null);
        expect(textTrackStyle.fontStyle).toBe(null);
        expect(textTrackStyle.foregroundColor).toBe(null);
        expect(textTrackStyle.windowColor).toBe(null);
        expect(textTrackStyle.windowRoundedCornerRadius).toBe(null);
        expect(textTrackStyle.windowType).toBe(null);
    });
});
