"use strict";

import meta from "../package.json";

import dedent from "dedent";
import minimist from "minimist";

import * as daemon from "./daemon";


const argv = minimist(process.argv.slice(2), {
    boolean: [ "daemon", "help", "version" ]
  , string: [ "port" ]
  , alias: {
        d: "daemon"
      , h: "help"
      , v: "version"
      , p: "port"
    }
  , default: {
        daemon: false
      , port: "9556"
    }
});


if (argv.version) {
    console.log(meta.__applicationVersion);
} else if (argv.help) {
    console.log(dedent`
        Usage: ${meta.__applicationExecutableName} [options]

        Options:
          -h, --help       Print usage info
          -v, --version    Print version info
          -d, --daemon     Launch in daemon mode. This starts a WebSocket server that
                           the extension can be configured to connect to under bridge
                           options.
          -p, --port       Set port number for WebSocket server. This must match the
                           port set in the extension options.

    `);
} else if (argv.daemon) {
    const port = parseInt(argv.port);
    if (!port || port < 1025 || port > 65535) {
        console.error("Invalid port specified!");
        process.exit(1);
    }

    daemon.init(port);
} else {
    import("./bridge");
}
