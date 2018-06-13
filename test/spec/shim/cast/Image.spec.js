"use strict";

const { create } = require("../../../driver");

describe("chrome.cast.Image", () => {
    let driver;

    beforeAll(async () => {
        driver = await create();
    });
    afterAll(() => {
        driver.quit();
    })


    it("should have all properties", async () => {
        const [ typeof_url
              , image ] = await driver.executeScript(() => {

            const image = new chrome.cast.Image();

            return [
                typeof image.url
              , image
            ];
        });

        expect(typeof_url).toBe("undefined");
        expect(image.height).toBe(null);
        expect(image.width).toBe(null);
    });

    it("should have expected assigned properties", async () => {
        const image = await driver.executeScript(() => {
            return new chrome.cast.Image("http://example.com");
        });

        expect(image.url).toBe("http://example.com");
    });
});
