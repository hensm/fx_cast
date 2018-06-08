"use strict";

// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.Image
export default class Image {
    width = null;
    height = null;

    constructor (url) {
        this.url = url;
    }
};
