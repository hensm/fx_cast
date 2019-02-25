"use strict";

export function getNextEllipsis (ellipsis) {
    return {
        "": "."
      , ".": ".."
      , "..": "..."
      , "...": ""
    }[ellipsis];
}

export function getWindowCenteredProps (refWin, width, height) {
    const centerX = refWin.left + (refWin.width / 2);
    const centerY = refWin.top + (refWin.height / 3);

    return {
        width, height
      , left: Math.floor(centerX - width / 2)
      , top: Math.floor(centerY - height / 2)
    };
}
