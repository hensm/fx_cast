"use strict";

const path = require("path");
const fs = require("fs");
const EventEmitter = require("events");

const glob = require("glob");
const WebSocket = require("ws");
const JasmineConsoleReporter = require("jasmine-console-reporter");

const webdriver = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");
const chrome = require("selenium-webdriver/chrome");

// Webdriver shorthands
const { By, until } = webdriver;

const { __extensionName, __extensionVersion } = require("../ext/package.json");

const extensionArchivePath = path.join(
    __dirname,
    "../dist/ext",
    `${__extensionName}-${__extensionVersion}.xpi`
);

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

const chromeOptions = new chrome.Options().excludeSwitches([
    "disable-background-networking",
    "disable-default-apps"
]);

/**
 * Chrome doesn't load the media router extension immediately
 * and there doesn't seem to be a consistent way of
 * determining when it has loaded.

 * Workaround is to poll every 100ms, refresh the page, and
 * check whether the chrome.cast API objects are defined.
 */
function waitUntilDefined(
    driver,
    pollingTimeout = 10000,
    pollingFrequency = 100
) {
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
 * Creates a WebSocket server. messageProxy.js creates a client
 * socket to this server and facilitates a communication
 * channel.
 */
class MessageProxy extends EventEmitter {
    constructor() {
        super();

        const wss = new WebSocket.Server({
            port: 8080
        });

        wss.on("connection", socket => {
            socket.on("message", message => {
                const messageContent = JSON.parse(message);
                this.emit(messageContent.subject, messageContent.data);
            });
        });
    }
}

/**
 * Ensures cast API is loaded before finding and injecting spec
 * file scripts into the test page.
 */
async function injectSpecs(driver) {
    const [loaded, errorInfo] = await driver.executeAsyncScript(() => {
        const callback = arguments[arguments.length - 1];

        // If already loaded, return immediately
        if (chrome.cast !== undefined) {
            callback([true]);
        }

        // Set Cast API callback
        window.__onGCastApiAvailable = function (...args) {
            callback(args);
        };
    });

    // Return error if API unavailable
    if (!loaded) {
        console.error("Failed to load cast API", errorInfo);
        return;
    }

    // Get spec files
    const specFiles = glob.sync("spec/**/*.spec.js", {
        cwd: __dirname
    });

    // Inject spec files
    for (const specFile of specFiles) {
        await driver.executeScript(`
            const scriptElement = document.createElement("script");
            scriptElement.src = "${specFile}";
            document.head.appendChild(scriptElement);
        `);
    }

    // Trigger Jasmine spec execution
    await driver.executeScript(() => {
        jasmine.getEnv().execute();
    });
}

(async () => {
    const driver = new webdriver.Builder()
        .forBrowser("firefox")
        .setFirefoxOptions(firefoxOptions)
        .setChromeOptions(chromeOptions)
        .build();

    const capabilities = await driver.getCapabilities();
    const browserName = capabilities.get("browserName");

    // Need to wait for cast extension on Chrome
    if (browserName === "chrome") {
        console.log("Waiting for cast extension...");
        await waitUntilDefined(driver);
        console.log("Cast extension loaded!");
    }

    // Create console reporter and message proxy.
    const reporter = new JasmineConsoleReporter();
    const messageProxy = new MessageProxy();

    // Inject specs when ready
    messageProxy.on("injectSpecs", () => {
        injectSpecs(driver);
    });

    /**
     * Forward events from Jasmine standlone via message proxy to
     * console reporter.
     */
    messageProxy.on("jasmineDone", result => reporter.jasmineDone(result));
    messageProxy.on("jasmineStarted", result =>
        reporter.jasmineStarted(result)
    );
    messageProxy.on("specDone", result => reporter.specDone(result));
    messageProxy.on("specStarted", result => reporter.specStarted(result));
    messageProxy.on("suiteDone", result => reporter.suiteDone(result));
    messageProxy.on("suiteStarted", result => reporter.suiteStarted(result));

    // Load Jasmine test page
    driver.get(TEST_PAGE_URL);
})();

// Keep process alive
process.stdin.resume();
