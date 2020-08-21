"use strict";

import { decodeTransform, encodeTransform } from "./lib/messaging";
import { Message } from "./types";

import { handleSessionMessage, handleMediaMessage, stopReceiverApp }
        from "./components/chromecast";
import { startDiscovery, stopDiscovery } from "./components/discovery";
import { startMediaServer, stopMediaServer } from "./components/mediaServer";
import { startReceiverSelector, stopReceiverSelector }
        from "./components/receiverSelector";

import { __applicationName, __applicationVersion} from "../../package.json";


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
    if (message.subject.startsWith("bridge:/session/")) {
        handleSessionMessage(message);
        return;
    }
    if (message.subject.startsWith("bridge:/media/")) {
        handleMediaMessage(message);
        return;
    }


    switch (message.subject) {
        case "bridge:/getInfo": {
            encodeTransform.write(__applicationVersion);
            break;
        }

        case "bridge:/initialize": {
            startDiscovery(message.data);
            break;
        }

        case "bridge:/stopReceiverApp": {
            stopReceiverApp(message.data.receiver.host
                          , message.data.receiver.port);
            break;
        }

        // Receiver selector
        case "bridge:/receiverSelector/open": {
            startReceiverSelector(message.data); break;
        }
        case "bridge:/receiverSelector/close": {
            stopReceiverSelector(); break;
        }

        // Media server
        case "bridge:/mediaServer/start": {
            startMediaServer(message.data.filePath, message.data.port);
            break;
        }
        case "bridge:/mediaServer/stop": {
            stopMediaServer();
            break;
        }
    }
});
