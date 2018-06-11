"use strict";

const { create, destroy } = require("./driver");


let driver;

module.exports = async () => {
    if (!driver) {
        driver = await create();
    }

    return driver;
};
