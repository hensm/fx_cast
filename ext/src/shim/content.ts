"use strict";

import { CAST_LOADER_SCRIPT_URL
       , CAST_SCRIPT_URLS } from "../lib/endpoints";


(window.wrappedJSObject as any).chrome = cloneInto({}, window);


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
        if (CAST_SCRIPT_URLS.includes(value)) {
            return set.call(this, CAST_LOADER_SCRIPT_URL);
        }

        return set.call(this, value);
    }, window)
});
