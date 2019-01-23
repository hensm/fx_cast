"use strict";

// Insert script before first script is run
document.addEventListener("beforescriptexecute", function onBeforeScriptExecute () {
    document.removeEventListener("beforescriptexecute", onBeforeScriptExecute);

    const scriptElement = document.createElement("script");
    scriptElement.src = browser.runtime.getURL("vendor/webcomponents-lite.min.js");
    document.head.prepend(scriptElement);
});
