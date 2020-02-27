# Extension Lifetime

## StatusManager

The StatusManager (`background/StatusManager.ts`) keeps a bridge instance active throughout the lifetime of the extension. It listens for `main:/serviceUp`, `main:/serviceDown` and `main:/receiverStatus` messages to keep track of and update a list of receiver devices that can be provided to other extension components. It also emits `serviceUp`, `serviceDown` and `statusUpdate` events containing relevant data.

If the StatusManager unexpectedly loses its bridge connection, it will automatically reconnect with a 10-second interval.

## Shim Initialization

The `shim/content.ts` content script is registered for all pages. It creates an empty `window.chrome` object in the page context since some sites may expect it to exist. It also intercepts any `src` attribute changes on `<script>` elements where the cast API may be loaded directly from a `chrome-extension://` URL, then sets them to the regular cast API script URL.

The background script registers a `webRequest.onBeforeRequest` listener that intercepts requests to Google’s Cast API library.

When a request is intercepted, the `shim/contentBridge.ts` script is executed in the content script context. This facilitates any message passing across content/page script isolation (the shim itself is executed in the page context, both for convenience — since it interacts substantially with page scripts — and to avoid page scripts calling into extension contexts).

Messages passed to the shim are custom events of type `__castMessage`. Messages passed back from the shim are custom events of type `__castMessageResponse`. Event listening and creation is handled by the `shim/eventMessageChannel.ts` module.

The `shim/contentBridge.ts` script creates a message port connection (named `"shim"`) to the background script through which messages from the shim are forwarded. Messages are forwarded to the bridge and other parts of the extension via the background script.  

The request is then redirected to the shim bundle (`shim/index.ts`) which creates the `window.chrome.cast` API object.

The `shim:/initialized` message is sent to the shim and the `window.__onGCastApiAvailable` callback is called with the availability state (bridge availability/compatibility is passed as the message data).

The cast API is now available to the web app.

The web app calls `chrome.cast.initialize` with an `ApiConfig` object containing the Chromecast receiver app ID to use. The shim sends a `main:/shimInitialized` message to the background script. The bridge sends `main:/serviceUp` messages for any discovered devices with device info (address, port, label, etc…).

### ShimManager

The ShimManager (`background/ShimManager.ts`) handles initialization of shims and communication between them and a bridge instance. Once created, it listens for and passes status updates from the StatusManager directly to any registered shims via `shim:/serviceUp`/`shim:/serviceDown` messages.

It provides a public `createShim` method which takes a `MessagePort` or `runtime.Port` port object as an input, but has different behavior depending on what type of port.

If the passed content port object is of type `MessagePort`, the shim was initialized in the background context, since we can't have a `runtime.Port` that outputs to itself (and we need some sort of message channel to pass as an output to the API consumer).

The `createShim` method passes off to the internal `createShimFromBackground` and `createShimFromContent` methods, which do mostly the same thing, except that content script context shims have extra checking for tab/frame IDs. The shim is registered, the bridge port is hooked up to the content port (and vice-versa with the other content message handling in internal method `handleContentMessage`).

A `Shim` object is returned which contains the required `bridgePort` and `contentPort` and optionally `contentTabId` and `contentFrameId` if initialized with a content script context shim.



### Module

The shim is designed to be injected into a running page or imported (via `shim/export.ts`) into another script. This is used for the built-in sender apps (media/mirroring) that run in the content script context.

If the shim is injected into a page, `contentBridge.ts` is executed in the content script context and the main shim bundle (`shim/index.ts`) replaces the page-loaded cast API loader script.

If the shim module is imported into another script, instead of setting the `window.__onGCastApiAvailable` callback, the module provides an `ensureInit` function which returns a promise. The consumer script must call this function and resolve the promise before calling any APIs (default export). The `ensureInit`-returned promise will resolve to a `MessagePort` object which can be used similarly to a WebExtension `runtime.Port`.

````ts
import cast, { ensureInit } from "./shim/export";

ensureInit().then(backgroundPort => {
    backgroundPort.postMessage({
        subject: "bridge:/doSomething"
    });

    const sessionRequest = new cast.SessionRequest(
            cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);
    
    // ...
});
````

It creates a `MessageChannel` object where the `port1` property is a `MessagePort` used by the API consumer to communicate with the background script.

Though the shim can only be imported into an extension context, hooking up message port communication is different depending on whether the it's a content script or background context.
It determines this by checking the current URL protocol for `moz-extension:`, which is only true for the background script.

The goal is for messages to be passed through the custom `MessageChannel` and routed appropriately, even if it's for a message that crosses no context boundaries (shim created and used in background context) where extension messaging cannot work.

**Note: This could be needlessly complex, so PRs welcome for any kind of simplification here.**

If in background context, the `ShimManager` is imported, initialized and the `port2` message port is passed to the `createShim` method which will setup the shim, pass messages from `port1` to the background script and pass messages from the background script back to `port1`. Incoming messages from `port1` are then passed over `shim/eventMessageChannel.ts` to the shim. Incoming messages from the shim over `shim/eventMessageChannel.ts` are posted to `port1`.

If instead in a content script context, `shim/contentBridge.ts` is imported and with side-effects (background script still calls into ShimManager), it creates and exports a `backgroundPort`. The incoming messages on that port are posted to `port2` and the incoming messages on `port2` are posted to `backgroundPort`.

<p align="center">
    <img src="diagram_module.svg"
         width="562"
         vspace="10" hspace="10">
</p>

In either case, `port1` as part of a message channel to the background script is resolved as the result of the `ensureInit` promise as soon as the `shim:/initialized` message is passed to the shim.


## User Interaction

A user will trigger casting through the web app interface and the app calls `chrome.cast.requestSession`. The shim sends a `main:/selectReceiverBegin` message to the background script to open the receiver selector.

The receiver selector is opened (popup browser window or native window depending on the receiver type). The receiver selector will handle user input and emit a `selected`, `cancelled`, or `error` event. Depending on the event, the background script will send a `shim:/selectReceiverEnd`, `shim:/selectReceiverCancelled` message to the shim. The `shim:/selectReceiverEnd` message contains info about the selected receiver and media type (`ReceiverSelection`).

The shim then makes a connection to the selected receiver device and establishes the session.

## Shim Implementation

Cast SDK API calls are translated into Chromecast protocol messages and sent via `node-castv2`. Based on [@GPMDP/electron-chromecast](https://github.com/GPMDP/electron-chromecast), so there are many similarities. The shim and the bridge exchange messages to implement API methods which require communication with the receiver device.

`Session` and `Media` objects have a counterpart object within the bridge. Some messages are routed directly to these objects. For `Session`, these are in the format `bridge:/session/impl_<methodName>`.


# Message Table (VERY OUTDATED)

<!--<img src="diagram.png" width="866">-->

| No. | Subject                                       | Origin     | Destination | Description |
| --: | --------------------------------------------- | ---------- | ----------- | ----------- |
|  1  | `shim:/initialized`                           | background | shim        | Sent once bridge has been created. |
|  2  | `bridge:/initialize`                          | shim       | bridge      | Starts network discovery. |
|  3  | `shim:/serviceUp`                             | bridge     | shim        | Sent once a receiver device has been found. |
|  4  | `shim:/serviceDown`                           | bridge     | shim        | Sent once a receiver device has been lost. |
|  5  | `main:/openPopup`                             | shim       | background  | Opens the receiver selection popup. |
|  6  | `popup:/assignShim`                           | background | popup       | Provides popup with tab/frame ID for the opener shim so that it can make a direct connection. |
|  7  | `shim:/popupReady`                            | popup      | shim        | Sent once popup is ready to receive data. |
|  8  | `popup:/populateReceiverList`                 | shim       | popup       | Provides popup with current `state.receiverList`. |
|  9  | `shim:/selectReceiver`                        | popup      | shim        | Sent once a receiver has been selected. |
| 10  | `popup:/close`                                | shim       | popup       | Closes popup. |
| 11  | `bridge:/session/initialize`                  | shim       | bridge      | Initializes cast session with receiver device. |
| 12  | `bridge:/session/close`                       | shim       | bridge      | Closes cast session. |
| 13  | `shim:/session/connected`                     | bridge     | shim        | Sent once cast session has connected. |
| 14  | `shim:/session/updateStatus`                  | bridge     | shim        | Provides shim session with status updates. |
| 15  | `bridge:/session/impl_addMessageListener`     | shim       | bridge      | Sends data to bridge for implementation of `Session#addMessageListener` method. |
| 16  | `bridge:/session/impl_sendMessage`            | shim       | bridge      | Sends data to bridge for implementation of `Session#sendMessage` method. |
| 17  | `bridge:/session/impl_setReceiverMuted`       | shim       | bridge      | Sends data to bridge for implementation of `Session#setReceiverMuted` method. |
| 18  | `bridge:/session/impl_setReceiverVolumeLevel` | shim       | bridge      | Sends data to bridge for implementation of `Session#setReceiverVolumeLevel` method. |
| 19  | `bridge:/session/impl_stop`                   | shim       | bridge      | Sends data to bridge for implementation of `Session#stop` method. |
| 20  | `bridge:/media/initialize`                    | shim       | bridge      | Initializes bridge media message handler. |
| 21  | `bridge:/media/sendMediaMessage`              | shim       | bridge      | Sends media message to receiver device. |
| 22  | `shim:/session/impl_addMessageListener`       | shim       | popup       | Response from bridge->shim counterpart message. |
| 23  | `shim:/session/impl_sendMessage`              | shim       | popup       | Response from bridge->shim counterpart message. |
| 24  | `shim:/session/impl_setReceiverMuted`         | shim       | popup       | Response from bridge->shim counterpart message. |
| 25  | `shim:/session/impl_setReceiverVolumeLevel`   | shim       | popup       | Response from bridge->shim counterpart message. |
| 26  | `shim:/session/impl_stop`                     | shim       | popup       | Response from bridge->shim counterpart message. |
| 27  | `shim:/media/sendMediaMessageResponse`        | shim       | popup       | Response from `sendMediaMessage`. Contains error status. |
| 28  | `shim:/media/update`                          | shim       | popup       | Provides shim media with status updates. |
| 29  | `bridge:/startHttpServer`                     | mediaCast  | bridge      | Starts HTTP server for serving local media to receiver device. |
| 30  | `bridge:/stopHttpServer`                      | mediaCast  | bridge      | Stops HTTP server. |
| 31  | `mediaCast:/httpServerStarted`                | bridge     | mediaCast   | Sent once HTTP server has started. |
| 32  | `updater:/updateData`                         | options    | updater     | Sends initialization data to updater popup. |

