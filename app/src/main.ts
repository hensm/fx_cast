"use strict";

import path from "path";
import minimist from "minimist";
import { __applicationVersion } from "../package.json";

const argv = minimist(process.argv.slice(2), {
    boolean: ["daemon", "help", "version"],
    string: ["__name", "port"],
    alias: {
        d: "daemon",
        h: "help",
        v: "version",
        p: "port"
    },
    default: {
        __name: path.basename(process.argv[0]),
        daemon: false,
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
  -p, --port       Set port number for WebSocket server. This must match the
                   port set in the extension options.
`
    );
} else if (argv.daemon) {
    const port = parseInt(argv.port);
    if (!port || port < 1025 || port > 65535) {
        console.error("Invalid port specified!");
        process.exit(1);
    }

    import("./daemon").then(daemon => {
        daemon.init(port);
    });
} else {
    import("./bridge");
}
