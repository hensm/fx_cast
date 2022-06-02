"use strict";

import Options from "./Options.svelte";

// macOS styles
browser.runtime.getPlatformInfo().then(platformInfo => {
    const link = document.createElement("link");
    link.rel = "stylesheet";

    switch (platformInfo.os) {
        case "mac": {
            link.href = "styles/mac.css";
            break;
        }
    }

    if (link.href) {
        document.head.appendChild(link);
    }
});

const target = document.getElementById("root");
if (target) {
    new Options({ target });
}
