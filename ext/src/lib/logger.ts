"use strict";

export class Logger {
    constructor (private prefix: string) {}

    log (message: string, data?: any) {
        const formattedMessage = `${this.prefix} (Log): ${message}`;
        if (data) {
            console.log(formattedMessage, data);
        } else {
            console.log(formattedMessage);
        }
    }
    info (message: string, data?: any) {
        const formattedMessage = `${this.prefix} (Info): ${message}`;
        if (data) {
            console.info(formattedMessage, data);
        } else {
            console.info(formattedMessage);
        }
    }
    error (message: string, data?: any) {
        const formattedMessage = `${this.prefix} (Error): ${message}`;
        if (data) {
            console.error(formattedMessage, data);
        } else {
            console.error(formattedMessage);
        }

        return new Error(formattedMessage);
    }
}

export default new Logger("fx_cast");
