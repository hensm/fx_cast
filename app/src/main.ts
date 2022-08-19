"use strict";

import yargs from "yargs";
import { applicationName, applicationVersion } from "../config.json";

const argv = yargs()
    .scriptName(applicationName)
    .usage("$0 [args]")
    .help()
    .alias("help", "h")
    .version(`v${applicationVersion}`)
    .alias("version", "v")
    .option("daemon", {
        alias: "d",
        describe: `Launch in daemon mode. This starts a WebSocket server that \
the extension can be configured to connect to under bridge options.`,
        type: "boolean"
    })
    .option("host", {
        alias: "n",
        describe: `Host for daemon WebSocket server. This must match the host \
set in the extension options.`,
        default: "localhost"
    })
    .option("port", {
        alias: "p",
        describe: `Port number for daemon WebSocket server. This must match \
the port set in the extension options.`,
        default: 9556
    })
    .option("password", {
        alias: "P",
        describe: `Set an optional password for the daemon WebSocket server. \
This must match the password set in the extension options.
WARNING: This password is intended only as a basic access control measure and \
is transmitted in plain text even over remote connections!`,
        type: "string"
    })
    .check(argv => {
        if (argv.port < 1025 || argv.port > 65535) {
            throw new Error("Invalid port specified!");
        }

        return true;
    })
    .parseSync(process.argv);

if (argv.daemon) {
    import("./daemon").then(daemon => {
        daemon.init({
            host: argv.host,
            port: argv.port,
            password: argv.password
        });
    });
} else {
    import("./bridge");
}
