"use strict";

export class Logger {
    constructor (private prefix: string) {}

    log (message: string) {
        console.log(`${this.prefix} (Log): ${message}`);
    }
    debug (message: string) {
        console.debug(`${this.prefix} (Debug): ${message}`);
    }
    error (message: string) {
        const formattedMessage = `${this.prefix} (Error): ${message}`;
        console.error(formattedMessage);
        return new Error(formattedMessage);
    }
}

export default new Logger("fx_cast");
