"use strict";

import messaging, { Message } from "./messaging";

import { handleCastMessage } from "./components/cast";
import { startDiscovery, stopDiscovery } from "./components/discovery";
import { startMediaServer, stopMediaServer } from "./components/mediaServer";

import { __applicationName, __applicationVersion } from "../../package.json";

process.on("SIGTERM", () => {
    stopDiscovery();
    stopMediaServer();
});

/**
 * Handle incoming messages from the extension and forward
 * them to the appropriate handlers.
 *
 * Initializes the counterpart objects and is responsible
 * for managing existing ones.
 */
messaging.on("message", (message: Message) => {
    switch (message.subject) {
        case "bridge:getInfo":
        case "bridge:/getInfo": {
            messaging.send(__applicationVersion);
            break;
        }

        case "bridge:startDiscovery": {
            startDiscovery(message.data);
            break;
        }

        // Media server
        case "bridge:startMediaServer": {
            const { filePath, port } = message.data;
            startMediaServer(filePath, port);
            break;
        }
        case "bridge:stopMediaServer": {
            stopMediaServer();
            break;
        }

        default: {
            handleCastMessage(message);
        }
    }
});
