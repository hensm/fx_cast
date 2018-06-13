"use strict";

const { create } = require("../../../driver");

describe("chrome.cast.Error", () => {
    let driver;

    beforeAll(async () => {
        driver = await create();
    });
    afterAll(() => {
        driver.quit();
    })


    it("should have all properties", async () => {
        const [ typeof_code
              , error ] = await driver.executeScript(() => {

            const error = new chrome.cast.Error();

            return [
                typeof error.code
              , error
            ];
        });

        expect(typeof_code).toBe("undefined");
        expect(error.description).toBe(null);
        expect(error.details).toBe(null);
    });

    it("should have expected assigned properties", async () => {
        const error = await driver.executeScript(() => {
            return new chrome.cast.Error(
                    chrome.cast.ErrorCode.CANCEL
                  , "testErrorDescription"
                  , { testErrorDetails: "testErrorDetails" });
        });

        expect(error.code).toBe("cancel");
        expect(error.description).toBe("testErrorDescription");
        expect(error.details).toEqual(
                { testErrorDetails: "testErrorDetails" });
    });
});
