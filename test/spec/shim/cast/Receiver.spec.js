"use strict";

const { create } = require("../../../driver");

describe("chrome.cast.Receiver", () => {
    let driver;

    beforeAll(async () => {
        driver = await create();
    });
    afterAll(() => {
        driver.quit();
    })


    it("should have all properties", async () => {
        const [ typeof_friendlyName
              , typeof_label
              , receiver ] = await driver.executeScript(() => {

            const receiver = new chrome.cast.Receiver();

            return [
                typeof receiver.friendlyName
              , typeof receiver.label
              , receiver
            ];
        });

        expect(typeof_friendlyName).toBe("undefined");
        expect(typeof_label).toBe("undefined");
        expect(receiver.capabilities).toEqual([]);
        expect(receiver.displayStatus).toBe(null);
        expect(receiver.isActiveInput).toBe(null);
        expect(receiver.receiverType).toBe("cast");
        expect(receiver.volume).toBe(null);
    });

    it("should have expected assigned properties", async () => {
        const error = await driver.executeScript(() => {
            return new chrome.cast.Receiver(
                    "testLabel"
                  , "testFriendlyName"
                  , [   chrome.cast.Capability.VIDEO_OUT
                      , chrome.cast.Capability.AUDIO_OUT ]
                  , new chrome.cast.Volume(1, false));
        });

        expect(error.capabilities).toEqual([ "video_out", "audio_out" ]);
        expect(error.friendlyName).toBe("testFriendlyName");
        expect(error.label).toBe("testLabel");
        expect(error.volume).toEqual({ level: 1, muted: false });
    });
});
