import fs from "fs";
import path from "path";

import yargs from "yargs";

import type { DaemonOpts } from "./daemon";

import { applicationName, applicationVersion } from "../config.json";
import { Messenger, StdioMessenger } from "./bridge/messaging";

const argv = yargs()
    .scriptName(applicationName)
    .usage("$0 [args]")
    .help()
    .alias("help", "h")
    .version(`v${applicationVersion}`)
    .alias("version", "v")
    .config("config", parseConfig)
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
Note: If using this option it is highly recommended that you enable secure \
connections to avoid leaking plaintext passwords!`,
        type: "string"
    })
    .option("secure", {
        alias: "s",
        describe: `Use a secure HTTPS server for WebSocket connections. \
Requires key/cert file options to be specified.`,
        type: "boolean",
        default: false
    })
    .option("key-file", {
        alias: "k",
        describe: `Path to the private key PEM file to use for the \
HTTPS server.`,
        type: "string"
    })
    .option("cert-file", {
        alias: "c",
        describe: `Path to the certificate PEM file to use for the \
HTTPS server.`,
        type: "string"
    })
    .check(argv => {
        // Ensure valid port range
        if (argv.port < 1025 || argv.port > 65535) {
            throw new Error("Invalid port specified!");
        }
        // Ensure secure options are valid
        if (argv.secure) {
            if (!argv["key-file"] || !argv["cert-file"]) {
                throw new Error("Missing required key/cert files.");
            }
            if (
                !fs.existsSync(argv["key-file"]) ||
                !fs.existsSync(argv["cert-file"])
            ) {
                throw new Error("Specified key/cert files do not exist.");
            }
        }

        return true;
    })
    .parseSync(process.argv);

/** Reads and parses yargs config file. */
function parseConfig(configPath: string) {
    let config: any;
    try {
        config = JSON.parse(fs.readFileSync(configPath, { encoding: "utf-8" }));
    } catch (err) {
        throw new Error(`Failed to parse config file!`);
    }

    // Resolve key/cert paths relative to config
    const configDirName = path.dirname(configPath);
    if (typeof config["key-file"] === "string") {
        config["key-file"] = path.resolve(configDirName, config["key-file"]);
    }
    if (typeof config["cert-file"] === "string") {
        config["cert-file"] = path.resolve(configDirName, config["cert-file"]);
    }

    return config;
}

async function main() {
    if (argv.daemon) {
        const daemon = await import("./daemon");
        const daemonOpts: DaemonOpts = {
            host: argv.host,
            port: argv.port,
            password: argv.password
        };
        if (argv.secure) {
            daemonOpts.secure = true;
            daemonOpts.key = fs.readFileSync(argv.keyFile!);
            daemonOpts.cert = fs.readFileSync(argv.certFile!);
        }

        daemon.init(daemonOpts);
    } else {
        const bridge = await import("./bridge");
        bridge.run(new StdioMessenger());
    }
}

main();
