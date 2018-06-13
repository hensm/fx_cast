"use strict";

const { create } = require("../../../driver");

describe("chrome.cast.DialRequest", () => {
    let driver;

    beforeAll(async () => {
        driver = await create();
    });
    afterAll(() => {
        driver.quit();
    })


    it("should have all properties", async () => {
        const [ typeof_appName
              , dialRequest ] = await driver.executeScript(() => {

            const dialRequest = new chrome.cast.DialRequest();

            return [
                typeof dialRequest.appName
              , dialRequest
            ];
        });

        expect(typeof_appName).toBe("undefined");
        expect(dialRequest.launchParameter).toBe(null);
    });

    it("should have expected assigned properties", async () => {
        const dialRequest = await driver.executeScript(() => {
            return new chrome.cast.DialRequest(
                  "testAppName"
                , "testLaunchParameter");
        });

        expect(dialRequest.appName).toBe("testAppName");
        expect(dialRequest.launchParameter).toBe("testLaunchParameter");
    });
});
