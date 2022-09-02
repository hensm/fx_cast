/**
 * Cast Chrome Sender SDK loader script.
 *
 * Since the actual SDK script is hosted locally within Chrome,
 * this script just acts a loader script whilst also doing some
 * UA string checking.
 */
export const CAST_LOADER_SCRIPT_URL =
    "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js";

/**
 * Cast Chrome Sender Framework API loader script.
 *
 * Same URL as the usual loader script, but the additional
 * search parameter is checked from within the script and
 * the framework API script is conditionally loaded in
 * addition to the regular SDK script.
 */
export const CAST_FRAMEWORK_LOADER_SCRIPT_URL = `${CAST_LOADER_SCRIPT_URL}?loadCastFramework=1`;

/**
 * Cast extension URLs.
 *
 * Cast functionality in Chrome was previously provided by
 * an extension. The cast SDK scripts are still provided via
 * chrome-extension: URLs for compatibility reasons (?).
 */
export const CAST_SCRIPT_URLS = [
    "chrome-extension://pkedcjkdefgpdelpbcmbmeomcjbeemfm/cast_sender.js",
    "chrome-extension://enhhojjnijigcajfphajepfemndkmdlo/cast_sender.js"
];

/**
 * Cast Chrome Sender Framework API script.
 *
 * The Cast Application Framework (CAF) is implemented as a
 * wrapper around the base SDK, and ditributed remotely, as
 * opposed to within the cast extension.
 */
export const CAST_FRAMEWORK_SCRIPT_URL =
    "https://www.gstatic.com/cast/sdk/libs/sender/1.0/cast_framework.js";
