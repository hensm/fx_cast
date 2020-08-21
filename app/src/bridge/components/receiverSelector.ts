"use strict";

import child_process from "child_process";
import path from "path";

import { EventEmitter } from "events";


function fatal (message: string) {
    console.error(message);
    process.exit(1);
}


let selectorApp: child_process.ChildProcess | undefined;
let selectorAppOpen = false;

declare interface ReceiverSelectorEventEmitter {
    on(ev: "selected", listener: (data: any) => void): this;
    on(ev: "stop", listener: (data: any) => void): this;
    on(ev: "close", listener: () => void): this;
    on(ev: "error", listener: (err: string) => void): this;
    on(ev: string, listener: (...args: any[]) => void): this;
}

class ReceiverSelectorEventEmitter extends EventEmitter {
    constructor (selectorProcess: child_process.ChildProcess) {
        super();

        if (selectorProcess.stdout) {
            selectorProcess.stdout.setEncoding("utf-8");    
            selectorProcess.stdout.on("data", data => {
                const jsonData = JSON.parse(data);

                if (!jsonData.mediaType) {
                    this.emit("stop", jsonData);
                    return;
                }

                this.emit("selected", jsonData);
            });
        }

        selectorProcess.on("error", err => {
            this.emit("error", err.message);
        });

        selectorProcess.on("close", () => {
            if (selectorAppOpen) {
                selectorAppOpen = false;

                this.emit("close");
            }
        });
    }
}

export function startReceiverSelector (
        data: string): ReceiverSelectorEventEmitter {

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

    return new ReceiverSelectorEventEmitter(selectorApp);
}

export function stopReceiverSelector () {
    if (!selectorApp?.killed) {
        selectorApp?.kill();
        selectorAppOpen = false;
    }
}
