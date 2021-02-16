"use strict";

// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.CredentialsData
export default class DialRequest {
    constructor (
            public credentials: string
          , public credentialsData: string) {
    }
}
