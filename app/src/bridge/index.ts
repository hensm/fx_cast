"use strict";

import { decodeTransform, encodeTransform } from "./lib/nativeMessaging";
import { Message } from "./messaging";

import { handleSessionMessage, handleMediaMessage, stopReceiverApp }
        from "./components/chromecast";
import { startDiscovery, stopDiscovery } from "./components/discovery";
import { startMediaServer, stopMediaServer } from "./components/mediaServer";
import { startReceiverSelector, stopReceiverSelector }
        from "./components/receiverSelector";

import { __applicationName, __applicationVersion } from "../../package.json";


process.on("SIGTERM", () => {
    stopDiscovery();
    stopMediaServer();
    stopReceiverSelector();
});


/**
 * Handle incoming messages from the extension and forward
 * them to the appropriate handlers.
 *
 * Initializes the counterpart objects and is responsible
 * for managing existing ones.
 */
decodeTransform.on("data", (message: Message) => {
    if (message.subject.startsWith("bridge:session/")) {
        handleSessionMessage(message);
        return;
    }
    if (message.subject.startsWith("bridge:media/")) {
        handleMediaMessage(message);
        return;
    }


    switch (message.subject) {
        case "bridge:getInfo":
        case "bridge:/getInfo": {
            encodeTransform.write(__applicationVersion);
            break;
        }

        case "bridge:initialize": {
            startDiscovery(message.data);
            break;
        }

        case "bridge:stopReceiverApp": {
            const { receiverDevice } = message.data;
            stopReceiverApp(receiverDevice.host, receiverDevice.port);
            break;
        }

        // Receiver selector
        case "bridge:openReceiverSelector": {
            startReceiverSelector(message.data); break;
        }
        case "bridge:closeReceiverSelector": {
            stopReceiverSelector(); break;
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
    }
});
