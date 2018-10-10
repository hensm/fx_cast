"use strict";

const path      = require("path");

const webdriver = require("selenium-webdriver");
const firefox   = require("selenium-webdriver/firefox");
const chrome    = require("selenium-webdriver/chrome");


const TEST_PAGE_URL = `file:///${__dirname}/test.html`;

const firefoxOptions = new firefox.Options()
    .headless()
    .addExtensions(path.resolve(__dirname, "../dist/ext/ext.xpi"))
    .setPreference("xpinstall.signatures.required", false);

const chromeOptions = new chrome.Options()
    .excludeSwitches("disable-default-apps")
    .addArguments(
        `--user-data-dir=${path.resolve(__dirname, "ChromeProfile")}`);


async function create () {
    const driver = new webdriver.Builder()
        .forBrowser('firefox')
        .setFirefoxOptions(firefoxOptions)
        .setChromeOptions(chromeOptions)
        .build();

    await driver.get(TEST_PAGE_URL);

    try {
        // Allow access from other specs
        this.driver = driver;
    } catch (err) {}

    return driver;
}

function destroy (driver = this.driver) {
    driver.quit();
}

module.exports = {
    create
  , destroy
}
