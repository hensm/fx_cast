"use strict";

import { ReceiverSelectorType } from "./background/receiverSelector";
import { Options } from "./lib/options";

export default {
    bridgeApplicationName: BRIDGE_NAME,
    bridgeBackupEnabled: false,
    bridgeBackupHost: "localhost",
    bridgeBackupPort: 9556,
    mediaEnabled: true,
    mediaOverlayEnabled: false,
    mediaSyncElement: false,
    mediaStopOnUnload: false,
    localMediaEnabled: true,
    localMediaServerPort: 9555,
    mirroringEnabled: false,
    mirroringAppId: MIRRORING_APP_ID,
    receiverSelectorCloseIfFocusLost: true,
    receiverSelectorWaitForConnection: true,
    userAgentWhitelistEnabled: true,
    userAgentWhitelistRestrictedEnabled: true,
    userAgentWhitelist: ["https://www.netflix.com/*"]
} as Options;
