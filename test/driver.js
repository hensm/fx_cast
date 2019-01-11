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
    .addExtensions(extensionArchivePath)
    .setPreference("xpinstall.signatures.required", false);

const chromeOptions = new chrome.Options()
    .excludeSwitches([ "disable-background-networking"
                     , "disable-default-apps"]);


/**
 * Chrome doesn't load the media router extension immediately
 * and there doesn't seem to be a consistent way of
 * determining when it has loaded.

 * Workaround is to poll every 100ms, refresh the page, and
 * check whether the chrome.cast API objects are defined.
 */
function waitUntilDefined (
        driver
      , pollingTimeout = 10000
      , pollingFrequency = 100) {

   return new Promise(async (resolve, reject) => {
        let time = pollingFrequency;

        const interval = setInterval(async () => {
            await driver.navigate().refresh();

            const isDefined = await driver.executeScript(() => {
                return window.chrome.cast !== undefined;
            });

            time += pollingFrequency;

            if (isDefined) {
                clearInterval(interval);
                resolve();
            } else if (time >= pollingTimeout) {
                reject("Timed out");
            }
        }, pollingFrequency);
    });
}

(async () => {
    const driver = new webdriver.Builder()
        .forBrowser("firefox")
        .setFirefoxOptions(firefoxOptions)
        .setChromeOptions(chromeOptions)
        .build();

    // Navigate to test page
    await driver.get(TEST_PAGE_URL);

    const capabilties = await driver.getCapabilities();
    switch (capabilties.get("browserName")) {
        // Need to wait for cast extension on Chrome
        case "chrome":
            console.log("Waiting for cast extension...");
            await waitUntilDefined(driver);
            console.log("Cast extension loaded!");

            break;

        case "firefox":
            break;
    }

    // Load Jasmine
    await driver.executeScript(() => {
        const iframe = document.querySelector("iframe");
        iframe.setAttribute("src", "SpecRunner.html");
    });
})();

// Keep process alive
process.stdin.resume();
