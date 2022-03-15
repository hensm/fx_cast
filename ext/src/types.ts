"use strict";

import { ReceiverStatus } from "./cast/api/types";

export interface ReceiverDevice {
    host: string;
    friendlyName: string;
    id: string;
    port: number;
    status?: ReceiverStatus;
}
