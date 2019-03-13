"use strict";

// Insert script before first script is run
document.addEventListener("beforescriptexecute", function onBeforeScriptExecute () {
    document.removeEventListener("beforescriptexecute", onBeforeScriptExecute);

    const scriptElement = document.createElement("script");
    scriptElement.src = browser.runtime.getURL("vendor/webcomponents-lite.min.js");
    document.head.prepend(scriptElement);
});


const EXT_SENDER_SCRIPT_URLS = [
    "chrome-extension://pkedcjkdefgpdelpbcmbmeomcjbeemfm/cast_sender.js"
  , "chrome-extension://enhhojjnijigcajfphajepfemndkmdlo/cast_sender.js"
];

const SENDER_SCRIPT_URL = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js";


// Store reference to original function
const _createElement = document.createElement;

function createElement () {
    // Call original function
    const element = _createElement.apply(this, arguments);

    /**
     * If the new element being created is a <script> element,
     * replace the src property setter to intercept the new value.
     *
     * If it matches Chrome's cast extension sender script URL,
     * replace it with the standard API URL, the request for which
     * is handled in the main script.
     */
    if (element.nodeName === "SCRIPT") {
        const { get, set } = Reflect.getOwnPropertyDescriptor(
                Reflect.getPrototypeOf(element.wrappedJSObject), "src");

        Reflect.defineProperty(element.wrappedJSObject, "src", {
            configurable: true
          , enumerable: true          
          , get

          , set: exportFunction(function (value) {
                if (EXT_SENDER_SCRIPT_URLS.includes(value)) {
                    return set.call(this, SENDER_SCRIPT_URL);
                }
                return set.call(this, value);
            }, window)
        });
    }

    return element;
}

// Redefine page's document.createElement function
exportFunction(createElement, document, {
    defineAs: "createElement"
});
