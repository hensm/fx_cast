"use strict";

window.jasmine = jasmineRequire.core(jasmineRequire);

jasmineRequire.html(jasmine);

const env = jasmine.getEnv();

// Copy to window
Object.assign(window, jasmineRequire.interface(jasmine, env));

// Create query string
const queryString = new jasmine.QueryString({
    getWindowLocation() {
        return window.location;
    }
});

// If spec is present in the query string
const filterSpecs = !!queryString.getParam("spec");

// Create HTML reporter
const htmlReporter = new jasmine.HtmlReporter({
    env,
    filterSpecs,
    timer: new jasmine.Timer(),

    getContainer() {
        return document.body;
    },

    // Bound functions
    navigateWithNewParam: queryString.navigateWithNewParam.bind(queryString),
    addToExistingQueryString:
        queryString.fullStringWithNewParam.bind(queryString),
    createElement: document.createElement.bind(document),
    createTextNode: document.createTextNode.bind(document)
});

// Create spec filter
const specFilter = new jasmine.HtmlSpecFilter({
    filterString() {
        return queryString.getParam("spec");
    }
});

// Add reporters
env.addReporter(jsApiReporter);
env.addReporter(htmlReporter);

// Configure Env
env.configure({
    failFast: queryString.getParam("failFast"),
    hideDisabled: queryString.getParam("hideDisabled"),
    oneFailurePerSpec: queryString.getParam("oneFailurePerSpec"),
    random: queryString.getParam("random"),
    seed: queryString.getParam("seed"),

    specFilter(spec) {
        return specFilter.matches(spec.getFullName());
    }
});

window.addEventListener("load", () => {
    htmlReporter.initialize();

    // Use messageProxy socket to request spec injection
    messageProxy.sendMessage({
        subject: "injectSpecs"
    });
});
