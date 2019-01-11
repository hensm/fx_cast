"use strict";

describe("chrome.cast.Receiver", () => {
    it("should have all properties", async () => {
        const receiver = new chrome.cast.Receiver();

        expect(typeof receiver.friendlyName).toBe("undefined");
        expect(typeof receiver.label).toBe("undefined");
        expect(receiver.capabilities).toEqual([]);
        expect(receiver.displayStatus).toBe(null);
        expect(receiver.isActiveInput).toBe(null);
        expect(receiver.receiverType).toBe("cast");
        expect(receiver.volume).toBe(null);
    });

    it("should have expected assigned properties", async () => {
        const receiver = new chrome.cast.Receiver(
                "testLabel"
              , "testFriendlyName"
              , [   chrome.cast.Capability.VIDEO_OUT
                  , chrome.cast.Capability.AUDIO_OUT ]
              , new chrome.cast.Volume(1, false));

        expect(receiver.capabilities).toEqual([ "video_out", "audio_out" ]);
        expect(receiver.friendlyName).toBe("testFriendlyName");
        expect(receiver.label).toBe("testLabel");
        expect(receiver.volume).toEqual(jasmine.objectContaining({ level: 1, muted: false }));
    });
});
