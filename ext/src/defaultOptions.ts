"use strict";

import type { WhitelistItemData } from "./background/whitelist";

export interface Options {
    bridgeApplicationName: string;
    bridgeBackupEnabled: boolean;
    bridgeBackupHost: string;
    bridgeBackupPort: number;
    mediaEnabled: boolean;
    mediaSyncElement: boolean;
    mediaStopOnUnload: boolean;
    localMediaEnabled: boolean;
    localMediaServerPort: number;
    mirroringEnabled: boolean;
    mirroringAppId: string;
    receiverSelectorCloseIfFocusLost: boolean;
    receiverSelectorWaitForConnection: boolean;
    siteWhitelistEnabled: boolean;
    siteWhitelist: WhitelistItemData[];
    siteWhitelistCustomUserAgent: string;
    showAdvancedOptions: boolean;

    [key: string]: Options[keyof Options];
}

export default {
    bridgeApplicationName: BRIDGE_NAME,
    bridgeBackupEnabled: false,
    bridgeBackupHost: "localhost",
    bridgeBackupPort: 9556,
    mediaEnabled: true,
    mediaSyncElement: false,
    mediaStopOnUnload: false,
    localMediaEnabled: true,
    localMediaServerPort: 9555,
    mirroringEnabled: false,
    mirroringAppId: MIRRORING_APP_ID,
    receiverSelectorCloseIfFocusLost: true,
    receiverSelectorWaitForConnection: true,
    siteWhitelistEnabled: true,
    siteWhitelist: [{ pattern: "https://www.netflix.com/*" }],
    siteWhitelistCustomUserAgent: "",
    showAdvancedOptions: false
} as Options;
