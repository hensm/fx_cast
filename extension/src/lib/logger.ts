export class Logger {
    constructor(private prefix: string) {}

    public log(message: string, data?: unknown) {
        const formattedMessage = `${this.prefix} (Log): ${message}`;
        if (data) {
            // eslint-disable-next-line no-console
            console.log(formattedMessage, data);
        } else {
            // eslint-disable-next-line no-console
            console.log(formattedMessage);
        }
    }
    public info(message: string, data?: unknown) {
        const formattedMessage = `${this.prefix} (Info): ${message}`;
        if (data) {
            console.info(formattedMessage, data);
        } else {
            console.info(formattedMessage);
        }
    }
    public warn(message: string, data?: unknown) {
        const formattedMessage = `${this.prefix} (Warning): ${message}`;
        if (data) {
            console.warn(formattedMessage, data);
        } else {
            console.warn(formattedMessage);
        }
    }
    public error(message: string, data?: unknown) {
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
