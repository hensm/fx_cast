"use strict";

import child_process from "child_process";
import path from "path";

import { sendMessage } from "../lib/messaging";


function fatal (message: string) {
    console.error(message);
    process.exit(1);
}


let selectorApp: child_process.ChildProcess | undefined;
let selectorAppOpen = false;

export function startReceiverSelector (data: string) {
    if (process.platform !== "darwin") {
        fatal("Invalid platform for native receiver selector.");
    }

    if (!data) {
        fatal("Missing native selector data");
    } else {
        try {
            JSON.parse(data);
        } catch (err) {
            fatal("Invalid native selector data.");
        }
    }

    if (selectorApp && selectorAppOpen) {
        selectorApp.kill();
        selectorAppOpen = false;
    }

    const selectorPath = path.join(process.cwd()
          , "fx_cast_selector.app/Contents/MacOS/fx_cast_selector");
 
    selectorApp = child_process.spawn(selectorPath, [ data ]);
    selectorAppOpen = true;

    if (selectorApp.stdout) {
        selectorApp.stdout.setEncoding("utf-8");    
        selectorApp.stdout.on("data", data => {
            const jsonData = JSON.parse(data);

            if (!jsonData.mediaType) {
                sendMessage({
                    subject: "main:/receiverSelector/stop"
                  , data: jsonData
                });

                return;
            }

            sendMessage({
                subject: "main:/receiverSelector/selected"
              , data: jsonData
            });
        });
    }

    selectorApp.on("error", err => {
        sendMessage({
            subject: "main:/receiverSelector/error"
          , data: err.message
        });
    });

    selectorApp.on("close", () => {
        if (selectorAppOpen) {
            selectorAppOpen = false;

            sendMessage({
                subject: "main:/receiverSelector/close"
            });
        }
    });
}

export function stopReceiverSelector () {
    if (!selectorApp?.killed) {
        selectorApp?.kill();
        selectorAppOpen = false;
    }
}
