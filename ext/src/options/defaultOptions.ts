"use strict";

export interface Options {
    [ key: string ]: any;
    mediaEnabled: boolean;
    mediaSyncElement: boolean;
    mediaStopOnUnload: boolean;
    localMediaEnabled: boolean;
    localMediaServerPort: number;
    mirroringEnabled: boolean;
    mirroringAppId: string;
    userAgentWhitelistEnabled: boolean;
    userAgentWhitelist: string[];
}

export default {
    mediaEnabled: true
  , mediaSyncElement: false
  , mediaStopOnUnload: false
  , localMediaEnabled: true
  , localMediaServerPort: 9555
  , mirroringEnabled: false
  , mirroringAppId: MIRRORING_APP_ID
  , userAgentWhitelistEnabled: true
  , userAgentWhitelist: [
        "https://www.netflix.com/*"
    ]
} as Options;
