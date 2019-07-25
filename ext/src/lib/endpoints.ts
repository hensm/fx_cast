"use strict";

/**
 * Cast sender API loader script URL.
 *
 * Since the actual cast sender API script is hosted locally
 * within Chrome, this script just acts a loader script for
 * the real script whilst also doing some UA string
 * checking.
 */
export const CAST_LOADER_SCRIPT_URL =
        "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js";

/**
 * Framework API loader script URL.
 *
 * Same URL as the usual loader script, but the additional
 * search parameter is checked from within the script and
 * the framework API script is conditionally loaded in
 * addition to the regular API script.
 */
export const CAST_FRAMEWORK_LOADER_SCRIPT_URL =
        `${CAST_LOADER_SCRIPT_URL}?loadCastFramework=1`;

/**
 * Cast API script URLs.
 *
 * Cast functionality in Chrome was previously provided by
 * an extension. The cast API script is still provided via
 * chrome-extension URLs for compatibility reasons.
 */
export const CAST_SCRIPT_URLS = [
    "chrome-extension://pkedcjkdefgpdelpbcmbmeomcjbeemfm/cast_sender.js"
  , "chrome-extension://enhhojjnijigcajfphajepfemndkmdlo/cast_sender.js"
];

/**
 * Framework API script URL.
 *
 * Unlike the basic cast sender API, the framework API is
 * not hosted locally within Chrome and is the only script
 * fetched directly from Google servers.
 */
export const CAST_FRAMEWORK_SCRIPT_URL =
        "https://www.gstatic.com/cast/sdk/libs/sender/1.0/cast_framework.js";
