"use strict";

import { ReceiverStatus } from "./shim/cast/types";

export interface ReceiverDevice {
    host: string;
    friendlyName: string;
    id: string;
    port: number;
    status?: ReceiverStatus;
}
