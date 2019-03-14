"use strict";

const _window = (window.wrappedJSObject as any);

_window.chrome = cloneInto({}, window);
_window.navigator.presentation = cloneInto({}, window);



const EXT_SENDER_SCRIPT_URLS = [
    "chrome-extension://pkedcjkdefgpdelpbcmbmeomcjbeemfm/cast_sender.js"
  , "chrome-extension://enhhojjnijigcajfphajepfemndkmdlo/cast_sender.js"
];

const SENDER_SCRIPT_URL = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js";


/**
 * Replace the src property setter on <script> elements to
 * intercept the new value.
 *
 * If it matches one of Chrome's cast extension sender script
 * URLs, replace it with the standard API URL, the request for
 * which is handled in the main script.
 */
const { get, set } = Reflect.getOwnPropertyDescriptor(
        HTMLScriptElement.prototype.wrappedJSObject, "src");

Reflect.defineProperty(
        HTMLScriptElement.prototype.wrappedJSObject, "src", {

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
