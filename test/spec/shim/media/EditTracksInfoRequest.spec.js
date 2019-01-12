"use strict";

describe("chrome.cast.media.EditTracksInfoRequest", () => {
    it("should have all properties", async () => {
        const editTracksInfoRequest = new chrome.cast.media.EditTracksInfoRequest();

        expect(editTracksInfoRequest.activeTrackIds).toBe(null);
        expect(editTracksInfoRequest.requestId).toBe(0);
        expect(editTracksInfoRequest.textTrackStyle).toBe(null);
    });

    it("should have expected assigned properties", async () => {
        const textTrackStyle = new chrome.cast.media.TextTrackStyle();
        textTrackStyle.backgroundColor = "#fefefeff";
        textTrackStyle.fontFamily = "__fontFamily";
        textTrackStyle.windowRoundedCornerRadius = 5;

        const editTracksInfoRequest = new chrome.cast.media.EditTracksInfoRequest(
                [ 5, 8, 12 ], textTrackStyle);

        expect(editTracksInfoRequest.activeTrackIds).toEqual([ 5, 8, 12 ]);
        expect(editTracksInfoRequest.textTrackStyle).toEqual(jasmine.objectContaining({
            backgroundColor: "#fefefeff"
          , fontFamily: "__fontFamily"
          , windowRoundedCornerRadius: 5
        }));
    });
});
