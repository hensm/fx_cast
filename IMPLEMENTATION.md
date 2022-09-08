# Implementation Details

**Note:** This is probably a bit verbose since I'm not too experienced with technical writing, but hopefully it will be of some use in explaining the more complex extension functionality.

## Messaging

The extension and bridge use a unified messaging format consisting of a JSON object with a `subject` string property and optional `data` property:

```ts
interface Message {
    subject: string;
    data?: any;
}
```

The message payloads are all fully-typed and defined in [`ext/src/messaging.ts`](./ext/src/messaging.ts). Wrappers around both WebExtension messaging and MessagePort APIs are used to provide type checking based on these message definitions. Almost all messages are sent via messaging connections, rather than one-off `sendMessage`/`postMessage` calls.

## Cast Instances

A cast instance is an initialized Web Sender SDK instance with the extension components that handle communication with receiver devices and other required functionality (like receiver selection) and is managed by the [Cast Manager](./ext/src/background/castManager.ts) background script module.

Only the [Base API](https://web.archive.org/web/20150318065431/https://developers.google.com/cast/docs/chrome_sender) (`chrome.cast`) is implemented, since the Framework API (`chrome.cast.framework`) is a wrapper around the Base API and doesn't require any extra functionality on the extension-side.

For some background, see [Cast SDK terminology](https://developers.google.com/cast/docs/web_sender/integrate#terminology).

### Communication

SDK instances send messages through a MessageChannel managed by the [`pageMessaging`](./ext/src/cast/pageMessaging.ts) module. One side listens for an initialization message containing a MessagePort, then receives messages from the SDK on that port and calls its message listeners so that they can be forwarded to the Cast Manager. The other side sends that initialization message and handles responses back from the Cast Manager.

### Initialization

The SDK can be initialized from page scripts (for web sender apps), or from extension scripts in a content script, extension page or background script context. Depending on the context, the way the cast instance is created happens differently.

#### Page script

In-page sender apps enable cast functionality by loading the remote Web Sender SDK script:  
`https://www.gstatic.com/cv/js/sender/v1/cast_sender.js`

This points to a loader script that checks the user agent string before injecting the proper SDK script into the page. In Chrome, the SDK script is actually hosted via a `chrome-extension://` URL as a [web accessible resource](https://developer.chrome.com/docs/extensions/mv3/manifest/web_accessible_resources/).

For an instance created for a page script SDK:

1. The [`contentInitial.ts`](./ext/src/cast/contentInitial.ts) content script is run at document start and handles some compatibility issues that can't be addressed via extension APIs (like SDK scripts directly loaded from `chrome-extension://` URLs).
2. The page loads the SDK via the usual Google-hosted `cast_sender.js` loader script.
3. The extension intercepts this script load, injects the [`contentBridge.ts`](./ext/src/cast/contentBridge.ts) script that creates a messaging connection to the Cast Manager (via extension messaging) that registers an instance for that context, and waits for a page messaging connection to forward messages through (as described [here](#communication)). The initial request is then transparently redirected to the extension-hosted SDK page script at [`src/cast/content.ts`](./src/cast/content.ts).
4. The SDK page script then creates the SDK objects ([`window.chrome.cast`](https://developers.google.com/cast/docs/reference/web_sender/chrome.cast)), handles loading the Framework API (if requested) and adds a page messaging listener for `cast:instanceCreated` events.
5. The Cast Manager sends a `cast:instanceCreated` message to the SDK, which then calls the sender app's entry handler ([`window.__onGCastApiAvailable`](https://developers.google.com/cast/docs/web_sender/integrate#initialization)).

#### Extension script

For an instance created for an extension script:

1. The extension script imports the [`cast/export.ts`](./ext/src/cast/export.ts) module which creates an SDK instance. Page messaging is still used to communicate with the SDK, despite the lack of a script context boundary to avoid complicating the SDK implementation.
2. The extension script calls the exported `ensureInit` async function.
   Depending on the extension script context:
    - If **background**: The Cast Manager is called directly, registering a new cast instance, providing it with a port for a newly-created message channel (since extension messaging is only supported between contexts). Page messaging is hooked up such that messages from the SDK are sent to the Cast Manager through this channel and vice versa.
    - If **content/extension page**: Much like with `contentBridge.ts`, a messaging channel is created to the Cast Manager and page messaging is hooked up (as described for page script instances).
3. Listeners are added for the `cast:instanceCreated` message, so that the `ensureInit` function can resolve its promise and provide a Cast Manager port after initialization.

Extension sender apps are considered to be trusted by the Cast Manager and are granted additional privileges. They can bypass the receiver selection step when requesting a session by providing a receiver device when initialising the SDK via `ensureInit`.

#### All contexts

The process now continues identically for all contexts:

1. The page's now-active sender app calls the [`chrome.cast.initialize`](https://developers.google.com/cast/docs/reference/web_sender/chrome.cast#.initialize) API function, sending a `main:initializeCastSdk` message to the Cast Manager, providing it with the [`chrome.cast.ApiConfig`](https://developers.google.com/cast/docs/reference/web_sender/chrome.cast.ApiConfig) data and prompting a receiver availability update.
2. The SDK handles the first `cast:receiverAvailabilityUpdated` message as an response to the `main:initializeCastSdk` message and calls the appropriate app callbacks.
3. The page is now free to request a session if receivers are available.

### Sessions

A sender app can request a session by calling the SDK's [`chrome.cast.requestSession`](https://developers.google.com/cast/docs/reference/web_sender/chrome.cast#.requestSession) method. This sends a `main:requestSession` message to the Cast Manager with a [`chrome.cast.SessionRequest`](https://developers.google.com/cast/docs/reference/web_sender/chrome.cast.SessionRequest?hl=en) object. This will trigger a receiver selection where the Cast Manager opens the popup UI and waits for the user to select a receiver device.

If the selection is cancelled, a `cast:sessionRequestCancelled` message is sent to the SDK instance allowing.

Otherwise, if a device is selected, the Cast Manager sends a `bridge:/createCastSession` message to the bridge instance which causes the bridge to launch the requested receiver app on the selected device. Once the app has launched and the cast session has been created, the bridge sends a `main:castSessionCreated` message and further `main:castSessionUpdated` messages back to the Cast Manager.

Upon receiving the session created/updated messages, the Cast Manager forwards the message to the SDK instance which creates/updates the [`chrome.cast.Session`](https://developers.google.com/cast/docs/reference/web_sender/chrome.cast.Session) object and calls the relevant app listener functions.

## Bridge

The bridge is a Node.js-based [native messaging](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging) host application that is launched by Firefox when the extension requests a bridge instance. It receives messages from the extension and provides service discovery and Chromecast device messaging/session management since the WebExtension APIs are too limited to implement this functionality.

### Daemon

The bridge can also be run as a daemon by launching the executable with the `-d`/`--daemon` flag. Instead of running as a messaging host, the bridge starts a WebSocket server and listens for incoming connections. On the extension-side, daemon support can be enabled which will automatically connect to a specified WebSocket server address whenever the WebExtension native messaging connection fails.

When an incoming connection is received the daemon acts as a native messaging server and spawns bridge instances as child processes. The daemon forwards incoming WebSocket messages to the bridge instances and sends responses back over `stdin`/`stdout` as usual.

Since the daemon is just a WebSocket server, it can configured to be used remotely, so the bridge doesn't have to be running on the same machine as the extension. However, remote connections could cause performance issues due to increased latency and may be unstable or insecure. Local media casting will also be unavailable.

## WebExtension Permissions

| Permission        | Description                                        | Usage                                                                                                                                              |
| ----------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `browser.history` | Access browsing history                            | When opening receiver selection popup windows, the history log is polluted unless these entries are removed.                                       |
| `menus`           | N/A                                                | Display context menus for casting on pages/media, and whitelist menus on the toolbar button.                                                       |
| `nativeMessaging` | Exchange messages with programs other than Firefox | Allows communciation with the bridge.                                                                                                              |
| `notifications`   | Display notifications to you                       | Show notifications if a bridge issue is found on startup.                                                                                          |
| `storage`         | N/A                                                | Store options data.                                                                                                                                |
| `tabs`            | Access browser tabs                                | Execute scripts within a sender application's tab content script context (possibly unnecessary due to host permissions).                           |
| `webNavigation`   | Access browser activity during navigation          | Get URL of frame to determine available cast media types.                                                                                          |
| `webRequest`      | N/A                                                | Intercept and redirect Cast SDK requests.                                                                                                          |
| `<all_urls>`      | Acess your data for all websites                   | Wildcard host permission since the extension uses its own match pattern whitelist (may want to switch to optional host permissions in the future). |
