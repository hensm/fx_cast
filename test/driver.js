"use strict";

const path = require("path");
const glob = require("glob");
const fs = require("fs");
const EventEmitter = require("events");

const JasmineConsoleReporter = require("jasmine-console-reporter");

const webdriver = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");
const chrome = require("selenium-webdriver/chrome");

// Webdriver shorthands
const { By, until } = webdriver;


const { __extensionName
      , __extensionVersion } = require("../ext/package.json");

const extensionArchivePath = path.join(
        path.join(__dirname, "../dist/ext/")
      , `${__extensionName}-${__extensionVersion}.xpi`);

if (!fs.existsSync(extensionArchivePath)) {
    console.error("Extension archive not found.");
    process.exit(1);
}


const TEST_PAGE_URL = `file:///${__dirname}/SpecRunner.html`;
const POLLING_PAGE_URL = `file:///${__dirname}/polling.html`;

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
        let elapsedTime = pollingFrequency;

        // Navigate to polling page
        await driver.get(POLLING_PAGE_URL);

        const interval = setInterval(async () => {
            await driver.navigate().refresh();

            const isDefined = await driver.executeScript(() => {
                return window.chrome.cast !== undefined;
            });

            elapsedTime += pollingFrequency;

            if (isDefined) {
                clearInterval(interval);
                resolve();
            } else if (elapsedTime >= pollingTimeout) {
                clearInterval(interval);
                reject("Timed out");
            }
        }, pollingFrequency);
    });
}

/**
 * Jasmine runs in browser context, but reporters for terminal
 * output run in node context. Need to forward reporter output
 * from Jasmine in the browser context to node context to use
 * reporters here.
 *
 * reporter.js is loaded on the test page and adds reporter
 * messages to the DOM which we listen for here.
 */
class ReporterProxy extends EventEmitter {
    constructor (driver) {
        super();
        this._driver = driver;
        this._wait();
    }

    async _wait () {
        const elementFilter = By.id("__msg");

        // Wait for message element
        await this._driver.wait(until.elementLocated(elementFilter))
        
        // Get message content
        const messageElement = this._driver.findElement(elementFilter);
        const messageContent = JSON.parse(await messageElement.getText());

        // Remove message element
        await this._driver.executeScript(() => {
            document.getElementById("__msg").remove();
        });

        // Send event
        this.emit(messageContent.subject, messageContent.data);

        // Wait for next event
        if (messageContent.subject !== "jasmineDone") {
            this._wait();
        }
    }
}


(async () => {
    const driver = new webdriver.Builder()
        .forBrowser("firefox")
        .setFirefoxOptions(firefoxOptions)
        .setChromeOptions(chromeOptions)
        .build();

    const capabilties = await driver.getCapabilities();
    const browserName = capabilties.get("browserName");

    // Need to wait for cast extension on Chrome
    if (browserName === "chrome") {
        console.log("Waiting for cast extension...");
        await waitUntilDefined(driver);
        console.log("Cast extension loaded!");
    }


    // Create console reporter and reporter proxy.
    const reporter = new JasmineConsoleReporter();
    const reporterProxy = new ReporterProxy(driver);

    /**
     * Forward events from Jasmine standlone via reporter proxy to
     * console reporter.
     */
    reporterProxy.on("jasmineDone"    , result => reporter.jasmineDone(result));
    reporterProxy.on("jasmineStarted" , result => reporter.jasmineStarted(result));
    reporterProxy.on("specDone"       , result => reporter.specDone(result));
    reporterProxy.on("specStarted"    , result => reporter.specStarted(result));
    reporterProxy.on("suiteDone"      , result => reporter.suiteDone(result));
    reporterProxy.on("suiteStarted"   , result => reporter.suiteStarted(result));


    // Load Jasmine test page
    await driver.get(TEST_PAGE_URL);
})();

// Keep process alive
process.stdin.resume();
