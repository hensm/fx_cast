# Daemon

As an alternative to Firefox's built-in native messaging system, the extension can connect to bridge instances over a WebSocket connection.

The bridge includes a daemon mode that can be started via the `-d`/`--daemon` command line option. This creates a WebSocket server and listens for incoming connections from the extension. When it receives a connection, it spawns a child bridge process and routes messages between the WebSocket connection and the bridge's IO streams, essentially acting as a native messaging server.

The primary use case for the daemon is to allow connections from within sandboxed versions of Firefox (like the Snap/Flatpak packages) running on the same machine. The WebSocket server listens on `localhost` by default, but this can be customised via the `-n`/`--host` and `-p`/`--port` command line options. This allows the extension to run on a machine where either the bridge is not supported / cannot be installed, or (more interestingly) to control receiver devices on a different network.

## Options

The bridge accepts several options to configure the daemon, either via the command-line, or via a JSON config file.

### Command-line

| Short | Long          | Type      | Default     | Description                                               |
| ----: | ------------- | --------- | ----------- | --------------------------------------------------------- |
|       | `--config`    | `string`  |             | Path to a JSON config file.                               |
|  `-d` | `--daemon`    | `boolean` | `false`     | Starts the bridge in daemon mode.                         |
|  `-n` | `--host`      | `string`  | `localhost` | Host to use for the WebSocket server.                     |
|  `-p` | `--port`      | `string`  | `9556`      | Port number to use for the WebSocket server.              |
|  `-P` | `--password`  | `string`  |             | The password to use for daemon connections.               |
|  `-s` | `--secure`    | `boolean` | `false`     | Use a secure HTTPS server for WebSocket connections.      |
|  `-k` | `--key-file`  | `string`  |             | Path to the private key file used for secure connections. |
|  `-c` | `--cert-file` | `string`  |             | Path to the certificate file used for secure connections. |

### Config File

To use a config, provide the path to the file with the `--config` command-line option. The config file keys should match the long command-line options. Path options specified as relative paths will be resolved relative to the config file.

```sh
$ fx_cast_bridge -d --config /path/to/config.json
```

Example config file:

```json
{
    "password": "my password",
    "secure": true,
    "key-file": "/path/to/key.pem",
    "cert-file": "/path/to/cert.pem"
}
```

## Secure Connections

By default the connections are unsecured. If the daemon is configured to listen for remote connections, enabling secure connections is recommended (in addition to setting a password).

This requires a private key and certificate pair to create the HTTPS connections.

### Setup

To generate a self-signed private key and certificate and configure the bridge:

1. Ensure OpenSSL is installed. This comes standard on macOS and most Linux distributions. On Windows, it's included with Git Bash, but [other packages](https://wiki.openssl.org/index.php/Binaries) are available.

2. Navigate to the directory where you want to create the files and run the following command:
    ```sh
    $ openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out cert.pem
    ```
3. Start the bridge daemon with the `-s/--secure` option and pass in the paths to the key/cert files that were just created:
    ```sh
    $ fx_cast_bridge -ds -k /path/to/key.pem -c /path/to/cert.pem
    ```
4. The bridge still won't be detected at this point as the self-signed certificate is not trusted, so navigate to the HTTPS URL for the bridge (by default: `"https://localhost:9556"`) and add a security exception.
5. Enable the _Use a secure connection_ option in the extension settings, ensure the bridge host/port values are correct, then refresh the bridge status to test.

### Passwords

A password option is provided to help secure remote connections. Start the bridge daemon, providing a password with the `-P`/`--password` option and ensure the password extension option matches:

```sh
$ fx_cast_bridge -ds -k /path/to/key.pem -c /path/to/cert.pem -P "my password"
```

**Note:** Though not recommended, the password option can be used without secure connections, in which case the password will be sent in plaintext over a standard HTTP connection and could be intercepted.
