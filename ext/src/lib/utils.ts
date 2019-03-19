"use strict";

export function getNextEllipsis (ellipsis: string): string {
    /* tslint:disable:curly */
    if (ellipsis === "") return ".";
    if (ellipsis === ".") return "..";
    if (ellipsis === "..") return "...";
    if (ellipsis === "...") return "";
    /* tslint:enable:curly */
}


interface WindowCenteredProps {
    width: number;
    height: number;
    left: number;
    top: number;
}

export function getWindowCenteredProps (
        refWin: browser.windows.Window
      , width: number
      , height: number): WindowCenteredProps {

    const centerX = refWin.left + (refWin.width / 2);
    const centerY = refWin.top + (refWin.height / 3);

    return {
        width, height
      , left: Math.floor(centerX - width / 2)
      , top: Math.floor(centerY - height / 2)
    };
}


// tslint:disable-next-line:max-line-length
export const REMOTE_MATCH_PATTERN_REGEX = /^(?:(?:(\*|https?|ftp):\/\/(\*|(?:\*\.(?:[^\/\*:]\.?)+(?:[^\.])|[^\/\*:]*))?)(\/.*)|<all_urls>)$/;
