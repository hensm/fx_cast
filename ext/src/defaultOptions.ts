"use strict";

import { ReceiverSelectorType } from "./receiver_selectors";

export interface Options {
    bridgeApplicationName: string;
    mediaEnabled: boolean;
    mediaSyncElement: boolean;
    mediaStopOnUnload: boolean;
    localMediaEnabled: boolean;
    localMediaServerPort: number;
    mirroringEnabled: boolean;
    mirroringAppId: string;
    receiverSelectorType: ReceiverSelectorType;

    // TODO: Implement
    receiverSelectorCloseIfFocusLost: boolean;
    receiverSelectorWaitForConnection: boolean;

    userAgentWhitelistEnabled: boolean;
    userAgentWhitelist: string[];

    [key: string]: Options[keyof Options];
}

const options: Options = {
    bridgeApplicationName: APPLICATION_NAME
  , mediaEnabled: true
  , mediaSyncElement: false
  , mediaStopOnUnload: false
  , localMediaEnabled: true
  , localMediaServerPort: 9555
  , mirroringEnabled: false
  , mirroringAppId: MIRRORING_APP_ID
  , receiverSelectorType: ReceiverSelectorType.Popup
  , receiverSelectorCloseIfFocusLost: true
  , receiverSelectorWaitForConnection: false
  , userAgentWhitelistEnabled: true
  , userAgentWhitelist: [
        "https://www.netflix.com/*"
    ]
};

export default options;
