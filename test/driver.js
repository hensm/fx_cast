"use strict";

const path = require("path");
const glob = require("glob");
const fs = require("fs");

const webdriver = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");
const chrome = require("selenium-webdriver/chrome");

const { __extensionName
      , __extensionVersion } = require("../ext/package.json");


const extensionArchivePath = path.join(
        path.join(__dirname, "../dist/ext/")
      , `${__extensionName}-${__extensionVersion}.xpi`);

if (!fs.existsSync(extensionArchivePath)) {
    console.error("Extension archive not found.");
    process.exit(1);
}


const TEST_PAGE_URL = `file:///${__dirname}/test.html`;

const firefoxOptions = new firefox.Options()
    .setBinary(firefox.Channel.NIGHTLY)
    .headless()
    .addExtensions(extensionArchivePath)
    .setPreference("xpinstall.signatures.required", false);

const chromeOptions = new chrome.Options()
    .excludeSwitches("disable-default-apps")
    .addArguments(
        `--user-data-dir=${path.resolve(__dirname, "ChromeProfile")}`);


async function create () {
    const driver = new webdriver.Builder()
        .forBrowser("firefox")
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
