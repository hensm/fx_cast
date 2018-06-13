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
        const [ typeof_appImages
              , typeof_statusText
              , receiverDisplayStatus ] = await driver.executeScript(() => {

            const receiverDisplayStatus =
                    new chrome.cast.ReceiverDisplayStatus();

            return [
                typeof receiverDisplayStatus.appImages
              , typeof receiverDisplayStatus.statusText
              , receiverDisplayStatus
            ];
        });

        expect(typeof_appImages).toBe("undefined");
        expect(typeof_statusText).toBe("undefined");
        expect(receiverDisplayStatus.showStop).toBe(null);
    });

    it("should have expected assigned properties", async () => {
        const receiverDisplayStatus = await driver.executeScript(() => {
            return new chrome.cast.ReceiverDisplayStatus(
                    "testStatusText"
                  , [
                        new chrome.cast.Image("http://example.com/1")
                      , new chrome.cast.Image("http://example.com/2")
                    ]);
        });

        expect(receiverDisplayStatus.statusText).toBe("testStatusText");
        expect(receiverDisplayStatus.appImages).toEqual([
            { url: "http://example.com/1", height: null, width: null }
          , { url: "http://example.com/2", height: null, width: null }
        ]);
    });
});
