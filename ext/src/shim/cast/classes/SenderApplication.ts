"use strict";

// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.SenderApplication
export default class SenderApplication {
    public packageId: string = null;
    public url: string = null;

    constructor (public platform: string) {}
};
