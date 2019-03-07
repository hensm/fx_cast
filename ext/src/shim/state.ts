"use strict";

import ApiConfig from "./cast/classes/ApiConfig";
import Receiver from "./cast/classes/Receiver";
import Session from "./cast/classes/Session";

export interface State {
    apiConfig: ApiConfig;
    receiverList: Receiver[];
    sessionList: Session[];
    sessionRequestInProgress: boolean;
}

// Global API state
const state: State = {
    apiConfig: null
  , receiverList: []
  , sessionList: []
  , sessionRequestInProgress: false
};

export default state;
