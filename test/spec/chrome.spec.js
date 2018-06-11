"use strict";

const { create, destroy } = require("../driver");


describe("chrome", () => {
    beforeEach(create.bind(this));
    afterEach(destroy.bind(this));

    it("should exist", async () => {
        const chrome = await this.driver.executeScript(() => {
            return window.chrome;
        });

        expect(typeof chrome).toBeDefined();
        expect(typeof chrome.cast).toBeDefined();
        expect(typeof chrome.cast.media).toBeDefined();
    });
});
