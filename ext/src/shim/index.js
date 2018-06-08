"use strict";

import cast  from "./cast";
import media from "./media";

if (!window.chrome) {
	window.chrome = {};
}

window.chrome.cast = cast;
window.chrome.cast.media = media;

// Call page's API loaded function if defined
const readyFunction = window.__onGCastApiAvailable;
console.log(readyFunction);
if (readyFunction && typeof readyFunction === "function") {
    readyFunction(true);
}
