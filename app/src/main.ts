"use strict";

import path from "path";
import minimist from "minimist";
import { __applicationVersion } from "../package.json";

const argv = minimist(process.argv.slice(2), {
    boolean: ["daemon", "help", "version"],
    string: ["__name", "host", "port", "password"],
    alias: {
        d: "daemon",
        h: "help",
        v: "version",
        n: "host",
        p: "port",
        P: "password"
    },
    default: {
        __name: path.basename(process.argv[0]),
        daemon: false,
        host: "localhost",
        port: "9556"
    }
});

if (argv.version) {
    // eslint-disable-next-line no-console
    console.log(`v${__applicationVersion}`);
} else if (argv.help) {
    // eslint-disable-next-line no-console
    console.log(
        `Usage: ${argv.__name} [options]

Options:
  -h, --help       Print usage info
  -v, --version    Print version info
  -d, --daemon     Launch in daemon mode. This starts a WebSocket server that
                     the extension can be configured to connect to under bridge
                     options.
  -n, --host       Host for daemon WebSocket server. This must match the host
                     set in the extension options.
  -p, --port       Port number for daemon WebSocket server. This must match the
                     port set in the extension options.
  -P, --password   Set an optional password for the daemon WebSocket server.
                     This must match the password set in the extension options.
                     WARNING: This password is intended only as a basic access
                     control measure and is transmitted in plain text even over
                     remote connections!
`
    );
} else if (argv.daemon) {
    const port = parseInt(argv.port);
    if (!port || port < 1025 || port > 65535) {
        console.error("Invalid port specified!");
        process.exit(1);
    }

    import("./daemon").then(daemon => {
        daemon.init({
            host: argv.host,
            port,
            password: argv.password
        });
    });
} else {
    import("./bridge");
}
