"use strict";

import { ReceiverSelectorMediaType } from "../background/receiverSelector";


export function getNextEllipsis (ellipsis: string): string {
    /* tslint:disable:curly */
    if (ellipsis === "") return ".";
    if (ellipsis === ".") return "..";
    if (ellipsis === "..") return "...";
    if (ellipsis === "...") return "";
    /* tslint:enable:curly */
}

/**
 * Template literal tag function, JSON-encodes substitutions.
 */
export function stringify (
        templateStrings: TemplateStringsArray
      , ...substitutions: any[]) {

    let formattedString = "";

    for (const templateString of templateStrings) {
        if (formattedString) {
            formattedString += JSON.stringify(substitutions.shift());
        }

        formattedString += templateString;
    }

    return formattedString;
}

export function getMediaTypesForPageUrl (
        pageUrl: string): ReceiverSelectorMediaType {

    let availableMediaTypes =
            ReceiverSelectorMediaType.App
          | ReceiverSelectorMediaType.Tab
          | ReceiverSelectorMediaType.Screen
          | ReceiverSelectorMediaType.File;

    /**
     * Remove "Screen" option when on an insecure origin as
     * MediaDevices.getDisplayMedia will not exist (and legacy
     * MediaDevices.getUserMedia mediaSource constraint will
     * fail).
     */
    if (!pageUrl.startsWith("https://")) {
        availableMediaTypes &= ~ReceiverSelectorMediaType.Screen;
    }

    return availableMediaTypes;
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


export function loadScript (
        scriptUrl: string
      , doc: Document = document): HTMLScriptElement {

    const scriptElement = doc.createElement("script");
    scriptElement.src = scriptUrl;
    (doc.head || doc.documentElement).append(scriptElement);

    return scriptElement;
}
