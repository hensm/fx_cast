/* eslint-disable max-len */
"use strict";

import React, { Component } from "react";
import ReactDOM from "react-dom";

import { menuIdPopupCast, menuIdPopupStop } from "../../background/menus";
import type { ReceiverSelectorPageInfo } from "../../background/ReceiverSelector";
import type { WhitelistItemData } from "../../background/whitelist";

import knownApps, { KnownApp } from "../../cast/knownApps";
import options from "../../lib/options";

import messaging, { Message, Port } from "../../messaging";
import { getNextEllipsis } from "../utils";
import { RemoteMatchPattern } from "../../lib/matchPattern";

import {
    ReceiverDevice,
    ReceiverDeviceCapabilities,
    ReceiverSelectionActionType,
    ReceiverSelectorMediaType
} from "../../types";

import { Capability } from "../../cast/sdk/enums";

const _ = browser.i18n.getMessage;

// macOS styles
browser.runtime.getPlatformInfo().then(platformInfo => {
    if (platformInfo.os === "mac") {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "styles/mac.css";
        document.head.appendChild(link);
    }
});

/**
 * Check receiver device capabilities bitflags against array of
 * capability strings requested by the sender application.
 */
function hasRequiredCapabilities(
    receiverDevice: ReceiverDevice,
    capabilities: Capability[] = []
) {
    const { capabilities: deviceCapabilities } = receiverDevice;
    return capabilities.every(capability => {
        switch (capability) {
            case Capability.AUDIO_IN:
                return deviceCapabilities & ReceiverDeviceCapabilities.AUDIO_IN;
            case Capability.AUDIO_OUT:
                return (
                    deviceCapabilities & ReceiverDeviceCapabilities.AUDIO_OUT
                );
            case Capability.MULTIZONE_GROUP:
                return (
                    deviceCapabilities &
                    ReceiverDeviceCapabilities.MULTIZONE_GROUP
                );
            case Capability.VIDEO_IN:
                return deviceCapabilities & ReceiverDeviceCapabilities.VIDEO_IN;
            case Capability.VIDEO_OUT:
                return (
                    deviceCapabilities & ReceiverDeviceCapabilities.VIDEO_OUT
                );
        }
    });
}

interface PopupAppProps {}
interface PopupAppState {
    /** List of devices to show in receiver list. */
    receiverDevices: ReceiverDevice[];

    /** Currently selected media type. */
    mediaType: ReceiverSelectorMediaType;
    /** Media types available to select. */
    availableMediaTypes: ReceiverSelectorMediaType;

    /** Sender app ID (if available). */
    appId?: string;
    /** Page info (if launched from page context). */
    pageInfo?: ReceiverSelectorPageInfo;

    /** App details (if matches known app). */
    knownApp?: KnownApp;
    /** Whether current page URL matches a whitelist pattern. */
    isPageWhitelisted: boolean;

    /** Whether casting to a device been initiated from this selector. */
    isConnecting: boolean;

    // Options
    mirroringEnabled: boolean;
    siteWhitelistEnabled: boolean;
    siteWhitelist: WhitelistItemData[];
}

class PopupApp extends Component<PopupAppProps, PopupAppState> {
    private port?: Port;
    private browserWindow?: browser.windows.Window;

    private resizeObserver = new ResizeObserver(() => {
        this.fitWindowHeight();
    });

    constructor(props: PopupAppProps) {
        super(props);

        this.state = {
            receiverDevices: [],
            mediaType: ReceiverSelectorMediaType.App,
            availableMediaTypes: ReceiverSelectorMediaType.App,
            isPageWhitelisted: false,
            isConnecting: false,
            mirroringEnabled: false,
            siteWhitelistEnabled: true,
            siteWhitelist: []
        };

        // Store window ref
        browser.windows.getCurrent().then(win => {
            this.browserWindow = win;
        });

        this.onMessage = this.onMessage.bind(this);
        this.onAddToWhitelist = this.onAddToWhitelist.bind(this);
        this.onReceiverCast = this.onReceiverCast.bind(this);
        this.onReceiverStop = this.onReceiverStop.bind(this);

        this.onContextMenu = this.onContextMenu.bind(this);
        this.onMenuShown = this.onMenuShown.bind(this);
        this.onMenuClicked = this.onMenuClicked.bind(this);
    }

    private onMessage(message: Message) {
        switch (message.subject) {
            case "popup:init":
                this.setState({
                    appId: message.data?.appId,
                    pageInfo: message.data?.pageInfo
                });
                break;
            case "popup:close":
                window.close();
                break;

            case "popup:update": {
                this.setState({
                    /**
                     * Filter receiver devices without the required
                     * capabilities.
                     */
                    receiverDevices: message.data.receiverDevices.filter(
                        receiverDevice => {
                            return hasRequiredCapabilities(
                                receiverDevice,
                                this.state.pageInfo?.sessionRequest
                                    ?.capabilities
                            );
                        }
                    )
                });

                const { availableMediaTypes, defaultMediaType } = message.data;
                if (
                    availableMediaTypes !== undefined &&
                    defaultMediaType !== undefined
                ) {
                    this.setState({
                        availableMediaTypes,
                        mediaType: defaultMediaType
                    });
                }

                this.updateKnownApp();
                break;
            }
        }
    }

    /** Resize browser window to fit content height. */
    private fitWindowHeight() {
        if (this.browserWindow?.id === undefined) {
            return;
        }

        browser.windows.update(this.browserWindow.id, {
            height:
                document.body.clientHeight +
                (window.outerHeight - window.innerHeight)
        });
    }

    private updateKnownApp() {
        const isAppMediaTypeAvailable = !!(
            this.state.availableMediaTypes & ReceiverSelectorMediaType.App
        );

        let knownApp: KnownApp | undefined;

        /**
         * Check knownApps for an app with an ID matching the registered
         * app on the target page.
         */
        if (isAppMediaTypeAvailable && this.state.appId) {
            knownApp = knownApps[this.state.appId];
        } else if (this.state.pageInfo) {
            const pageUrl = this.state.pageInfo.url;

            /**
             * Or if there isn't an registered app, check for an app
             * with a match pattern matching the target page URL.
             */
            for (const [, app] of Object.entries(knownApps)) {
                if (!app.matches) {
                    continue;
                }

                const pattern = new RemoteMatchPattern(app.matches);
                if (pattern.matches(pageUrl)) {
                    knownApp = app;
                    break;
                }
            }
        }

        let isPageWhitelisted = false;

        // Check if target page URL is whitelisted.
        if (this.state.pageInfo) {
            for (const item of this.state.siteWhitelist) {
                const pattern = new RemoteMatchPattern(item.pattern);
                if (pattern.matches(this.state.pageInfo.url)) {
                    isPageWhitelisted = true;
                    break;
                }
            }
        }

        this.setState({ knownApp, isPageWhitelisted });
    }

    private async onAddToWhitelist(
        app: KnownApp,
        pageInfo: ReceiverSelectorPageInfo
    ) {
        if (!app.matches) {
            return;
        }

        const whitelist = await options.get("siteWhitelist");
        if (!whitelist.find(item => item.pattern === app.matches)) {
            whitelist.push({ pattern: app.matches });
            await options.set("siteWhitelist", whitelist);

            await browser.tabs.reload(pageInfo.tabId);
            window.close();
        }
    }

    private onReceiverCast(receiverDevice: ReceiverDevice) {
        this.setState({ isConnecting: true });

        this.port?.postMessage({
            subject: "receiverSelector:selected",
            data: {
                receiverDevice,
                actionType: ReceiverSelectionActionType.Cast,
                mediaType: this.state.mediaType
            }
        });
    }

    private onReceiverStop(receiverDevice: ReceiverDevice) {
        this.port?.postMessage({
            subject: "receiverSelector:stop",
            data: {
                receiverDevice,
                actionType: ReceiverSelectionActionType.Stop
            }
        });
    }

    private onContextMenu(ev: MouseEvent) {
        if (!(ev.target instanceof Element)) return;

        const receiverElement = ev.target.closest(".receiver");
        if (receiverElement) {
            browser.menus.overrideContext({
                showDefaults: false
            });
        }
    }

    private getDeviceFromElement(target: Element) {
        const receiverElement = target.closest(".receiver");
        if (!receiverElement) return;

        const receiverElementIndex = [
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            ...receiverElement.parentElement!.children
        ].indexOf(receiverElement);

        // Match by index rendered receiver element to device array
        if (receiverElementIndex > -1) {
            return this.state.receiverDevices[receiverElementIndex];
        }
    }

    /** Handle show events for receiver context menus. */
    private onMenuShown(info: browser.menus._OnShownInfo) {
        if (!info.targetElementId) return;
        const target = browser.menus.getTargetElement(info.targetElementId);
        if (!target) return;

        const device = this.getDeviceFromElement(target);
        if (!device) {
            browser.menus.update(menuIdPopupCast, { visible: false });
            browser.menus.update(menuIdPopupStop, { visible: false });
        } else {
            const app = device.status?.applications?.[0];
            const isAppRunning = !!(app && !app.isIdleScreen);

            browser.menus.update(menuIdPopupCast, {
                visible: true,
                title: _("popupCastMenuTitle", device.friendlyName),
                enabled:
                    // Not already connecting to a receiver
                    !this.state.isConnecting &&
                    // Selected media type available
                    !!(this.state.availableMediaTypes & this.state.mediaType)
            });

            browser.menus.update(menuIdPopupStop, {
                visible: isAppRunning,
                title: isAppRunning
                    ? _("popupStopMenuTitle", [
                          app.displayName,
                          device.friendlyName
                      ])
                    : ""
            });
        }

        browser.menus.refresh();
    }

    /** Handle click events for receiver context menus. */
    private onMenuClicked(info: browser.menus.OnClickData) {
        if (
            info.menuItemId !== menuIdPopupCast &&
            info.menuItemId !== menuIdPopupStop
        ) {
            return;
        }

        if (!info.targetElementId) return;
        const target = browser.menus.getTargetElement(info.targetElementId);
        if (!target) return;

        const device = this.getDeviceFromElement(target);
        if (!device) return;

        switch (info.menuItemId) {
            case menuIdPopupCast:
                this.onReceiverCast(device);
                break;
            case menuIdPopupStop:
                this.onReceiverStop(device);
                break;
        }
    }

    public async componentDidMount() {
        this.port = messaging.connect({ name: "popup" });
        this.port.onMessage.addListener(this.onMessage);

        // Start observing content size changes
        this.resizeObserver.observe(document.body);

        options.getAll().then(opts => {
            this.setState({
                mirroringEnabled: opts.mirroringEnabled,
                siteWhitelistEnabled: opts.siteWhitelistEnabled,
                siteWhitelist: opts.siteWhitelist
            });
        });

        this.updateKnownApp();

        window.addEventListener("contextmenu", this.onContextMenu);
        browser.menus.onClicked.addListener(this.onMenuClicked);
        browser.menus.onShown.addListener(this.onMenuShown);
    }

    public componentWillUnmount() {
        this.port?.disconnect();
        this.resizeObserver.disconnect();

        window.removeEventListener("contextmenu", this.onContextMenu);
        browser.menus.onClicked.removeListener(this.onMenuClicked);
        browser.menus.onShown.removeListener(this.onMenuShown);
    }

    public componentDidUpdate() {
        setTimeout(() => {
            this.fitWindowHeight();
        }, 1);
    }

    public render() {
        const isAppMediaTypeSelected =
            this.state.mediaType === ReceiverSelectorMediaType.App;
        const isTabMediaTypeSelected =
            this.state.mediaType === ReceiverSelectorMediaType.Tab;
        const isScreenMediaTypeSelected =
            this.state.mediaType === ReceiverSelectorMediaType.Screen;

        const isAppMediaTypeAvailable = !!(
            this.state.availableMediaTypes & ReceiverSelectorMediaType.App
        );

        return (
            <>
                <div
                    className="whitelist-banner"
                    hidden={
                        // If we don't know the app
                        !this.state.knownApp ||
                        // If the whitelist is disabled
                        !this.state.siteWhitelistEnabled ||
                        // If the whitelist is enabled, and the page is whitelisted
                        (this.state.siteWhitelistEnabled &&
                            this.state.isPageWhitelisted) ||
                        // If an app is already loaded on the page
                        !!(
                            this.state.availableMediaTypes &
                            ReceiverSelectorMediaType.App
                        )
                    }
                >
                    <img src="photon_info.svg" />
                    {_(
                        "popupWhitelistNotWhitelisted",
                        this.state.knownApp?.name
                    )}
                    <button
                        onClick={() => {
                            if (!this.state.knownApp || !this.state.pageInfo) {
                                return;
                            }

                            this.onAddToWhitelist(
                                this.state.knownApp,
                                this.state.pageInfo
                            );
                        }}
                    >
                        {_("popupWhitelistAddToWhitelist")}
                    </button>
                </div>

                <div className="media-type-select">
                    <div className="media-type-select__label-cast">
                        {_("popupMediaSelectCastLabel")}
                    </div>
                    <div className="select-wrapper">
                        <select
                            onChange={ev =>
                                this.setState({
                                    mediaType: parseInt(ev.target.value)
                                })
                            }
                            className="media-type-select__dropdown"
                            disabled={
                                this.state.availableMediaTypes ===
                                ReceiverSelectorMediaType.None
                            }
                        >
                            <option
                                value={ReceiverSelectorMediaType.App}
                                selected={isAppMediaTypeSelected}
                                disabled={!isAppMediaTypeAvailable}
                            >
                                {this.state.knownApp?.name ??
                                    _("popupMediaTypeApp")}
                            </option>

                            {this.state.mirroringEnabled && (
                                <>
                                    <option
                                        value={ReceiverSelectorMediaType.Tab}
                                        selected={isTabMediaTypeSelected}
                                        disabled={
                                            !(
                                                this.state.availableMediaTypes &
                                                ReceiverSelectorMediaType.Tab
                                            )
                                        }
                                    >
                                        {_("popupMediaTypeTab")}
                                    </option>
                                    <option
                                        value={ReceiverSelectorMediaType.Screen}
                                        selected={isScreenMediaTypeSelected}
                                        disabled={
                                            !(
                                                this.state.availableMediaTypes &
                                                ReceiverSelectorMediaType.Screen
                                            )
                                        }
                                    >
                                        {_("popupMediaTypeScreen")}
                                    </option>
                                </>
                            )}
                        </select>
                    </div>
                    <div className="media-type-select__label-to">
                        {_("popupMediaSelectToLabel")}
                    </div>
                </div>

                <ul className="receivers">
                    {!this.state.receiverDevices.length ? (
                        <div className="receivers__not-found">
                            {_("popupNoReceiversFound")}
                        </div>
                    ) : (
                        this.state.receiverDevices.map((device, i) => (
                            <Receiver
                                details={device}
                                isAnyConnecting={this.state.isConnecting}
                                isMediaTypeAvailable={
                                    !!(
                                        this.state.availableMediaTypes &
                                        this.state.mediaType
                                    )
                                }
                                onCast={this.onReceiverCast}
                                onStop={this.onReceiverStop}
                                key={i}
                            />
                        ))
                    )}
                </ul>
            </>
        );
    }
}

interface ReceiverProps {
    details: ReceiverDevice;
    isMediaTypeAvailable: boolean;
    isAnyConnecting: boolean;

    // Events
    onCast(receiverDevice: ReceiverDevice): void;
    onStop(receiverDevice: ReceiverDevice): void;
}
interface ReceiverState {
    isConnecting: boolean;
    connectingEllipsis: string;
}
class Receiver extends Component<ReceiverProps, ReceiverState> {
    private ellipsisInterval?: number;

    constructor(props: ReceiverProps) {
        super(props);

        this.state = {
            isConnecting: false,
            connectingEllipsis: ""
        };

        this.handleCast = this.handleCast.bind(this);
    }

    private handleCast() {
        if (!this.props.details.status) {
            return;
        }

        this.ellipsisInterval = window.setInterval(() => {
            this.setState(state => ({
                connectingEllipsis: getNextEllipsis(state.connectingEllipsis)
            }));
        }, 500);

        this.setState({ isConnecting: true });
        this.props.onCast(this.props.details);
    }

    componentWillUnmount() {
        window.clearInterval(this.ellipsisInterval);
    }

    render() {
        const application = this.props.details.status?.applications?.[0];

        return (
            <li className="receiver">
                <div className="receiver__name">
                    {this.props.details.friendlyName}
                </div>
                <div className="receiver__address">
                    {application && !application.isIdleScreen
                        ? application.statusText
                        : `${this.props.details.host}:${this.props.details.port}`}
                </div>
                <button
                    className="button receiver__connect"
                    onClick={this.handleCast}
                    disabled={
                        this.props.isAnyConnecting ||
                        this.state.isConnecting ||
                        !this.props.isMediaTypeAvailable
                    }
                >
                    {this.state.isConnecting
                        ? _(
                              "popupCastingButtonTitle",
                              this.state.isConnecting
                                  ? this.state.connectingEllipsis
                                  : ""
                          )
                        : _("popupCastButtonTitle")}
                </button>
            </li>
        );
    }
}

// Render after CSS has loaded
window.addEventListener("load", () => {
    ReactDOM.render(<PopupApp />, document.querySelector("#root"));
});
