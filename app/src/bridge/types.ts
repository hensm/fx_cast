"use strict";

import { ReceiverStatus } from "./components/cast/types";

export interface ReceiverDevice {
    host: string;
    friendlyName: string;
    id: string;
    port: number;
    status?: ReceiverStatus;
}
