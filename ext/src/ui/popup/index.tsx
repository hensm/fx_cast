/* eslint-disable max-len */
"use strict";

import React, { Component } from "react";
import ReactDOM from "react-dom";

import knownApps, { KnownApp } from "../../cast/knownApps";
import options from "../../lib/options";

import messaging, { Message, Port } from "../../messaging";
import { getNextEllipsis } from "../../lib/utils";
import { RemoteMatchPattern } from "../../lib/matchPattern";

import { ReceiverDevice, ReceiverDeviceCapabilities } from "../../types";
import { Capability } from "../../cast/sdk/enums";

import {
    ReceiverSelectionActionType,
    ReceiverSelectorMediaType
} from "../../background/receiverSelector";
import { PageInfo } from "../../background/receiverSelector/ReceiverSelector";

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
    receiverDevices: ReceiverDevice[];
    mediaType: ReceiverSelectorMediaType;
    availableMediaTypes: ReceiverSelectorMediaType;
    isLoading: boolean;

    filePath?: string;
    appId?: string;
    pageInfo?: PageInfo;

    mirroringEnabled: boolean;
    userAgentWhitelistEnabled: boolean;
    userAgentWhitelist: string[];

    knownApp?: KnownApp;
    isPageWhitelisted: boolean;
}

class PopupApp extends Component<PopupAppProps, PopupAppState> {
    private port?: Port;
    private win?: browser.windows.Window;
    private defaultMediaType?: ReceiverSelectorMediaType;

    constructor(props: PopupAppProps) {
        super(props);

        this.state = {
            receiverDevices: [],
            mediaType: ReceiverSelectorMediaType.App,
            availableMediaTypes: ReceiverSelectorMediaType.App,
            isLoading: false,
            mirroringEnabled: false,
            userAgentWhitelistEnabled: true,
            userAgentWhitelist: [],
            isPageWhitelisted: false
        };

        // Store window ref
        browser.windows.getCurrent().then(win => {
            this.win = win;
        });

        new ResizeObserver(() => {
            this.updateWindowHeight();
        }).observe(document.body);

        this.onAddToWhitelist = this.onAddToWhitelist.bind(this);
        this.onSelectChange = this.onSelectChange.bind(this);
        this.onCast = this.onCast.bind(this);
        this.onStop = this.onStop.bind(this);
    }

    public updateWindowHeight() {
        if (this.win?.id === undefined) {
            return;
        }

        const frameHeight = window.outerHeight - window.innerHeight;
        const windowHeight = document.body.clientHeight + frameHeight;

        browser.windows.update(this.win.id, {
            height: windowHeight
        });
    }

    public async componentDidMount() {
        this.port = messaging.connect({ name: "popup" });

        this.port.onMessage.addListener((message: Message) => {
            switch (message.subject) {
                case "popup:init": {
                    this.setState({
                        appId: message.data?.appId,
                        pageInfo: message.data?.pageInfo
                    });

                    break;
                }

                case "popup:update": {
                    const {
                        receiverDevices,
                        availableMediaTypes,
                        defaultMediaType
                    } = message.data;

                    this.setState({
                        /**
                         * Filter receiver devices without the required
                         * capabilities.
                         */
                        receiverDevices: receiverDevices.filter(
                            receiverDevice => {
                                return hasRequiredCapabilities(
                                    receiverDevice,
                                    this.state.pageInfo?.sessionRequest
                                        ?.capabilities
                                );
                            }
                        )
                    });

                    if (
                        availableMediaTypes !== undefined &&
                        defaultMediaType !== undefined
                    ) {
                        this.defaultMediaType = defaultMediaType;
                        this.setState({
                            availableMediaTypes,
                            mediaType: defaultMediaType
                        });
                    }

                    this.updateKnownApp();

                    break;
                }

                case "popup:close": {
                    window.close();
                    break;
                }
            }
        });

        const opts = await options.getAll();

        this.setState({
            mirroringEnabled: opts.mirroringEnabled,
            userAgentWhitelistEnabled: opts.userAgentWhitelistEnabled,
            userAgentWhitelist: opts.userAgentWhitelist
        });

        this.updateKnownApp();
    }

    public componentDidUpdate() {
        setTimeout(() => {
            this.updateWindowHeight();
        }, 1);
    }

    private updateKnownApp() {
        const isAppMediaTypeAvailable = !!(
            this.state.availableMediaTypes & ReceiverSelectorMediaType.App
        );

        let knownApp: Nullable<KnownApp> = null;

        /**
         * Check knownApps for an app with an ID matching the registered
         * app on the target page.
         * Or if there isn't an registered app, check for an app with a
         * match pattern matching the target page URL.
         */
        if (isAppMediaTypeAvailable && this.state.appId) {
            knownApp = knownApps[this.state.appId];
        } else if (this.state.pageInfo) {
            const pageUrl = this.state.pageInfo.url;

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

        /**
         * Check if target page URL is whitelisted.
         */
        if (this.state.pageInfo) {
            for (const patternString of this.state.userAgentWhitelist) {
                const pattern = new RemoteMatchPattern(patternString);
                if (pattern.matches(this.state.pageInfo.url)) {
                    isPageWhitelisted = true;
                    break;
                }
            }
        }

        this.setState({
            knownApp: knownApp ?? undefined,
            isPageWhitelisted
        });
    }

    public render() {
        /*

        // TODO: Add file support back to popup

        let truncatedFileName: string;

        if (this.state.filePath) {
            const filePath = this.state.filePath;
            const fileName = filePath.substring(filePath.lastIndexOf("/") + 1);

            truncatedFileName = fileName.length > 12
                ? `${fileName.substring(0, 12)}...`
                : fileName;
        }
        */

        const isAppMediaTypeSelected =
            this.state.mediaType === ReceiverSelectorMediaType.App;
        const isTabMediaTypeSelected =
            this.state.mediaType === ReceiverSelectorMediaType.Tab;
        const isScreenMediaTypeSelected =
            this.state.mediaType === ReceiverSelectorMediaType.Screen;

        const isSelectedMediaTypeAvailable = !!(
            this.state.availableMediaTypes & this.state.mediaType
        );
        const isAppMediaTypeAvailable = !!(
            this.state.availableMediaTypes & ReceiverSelectorMediaType.App
        );

        return (
            <>
                <div
                    className="whitelist-suggest"
                    hidden={
                        // If we don't know the app
                        !this.state.knownApp ||
                        // If the whitelist is disabled
                        !this.state.userAgentWhitelistEnabled ||
                        // If the whitelist is enabled, and the page is whitelisted
                        (this.state.userAgentWhitelistEnabled &&
                            this.state.isPageWhitelisted) ||
                        // If an app is already loaded on the page
                        isAppMediaTypeAvailable
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
                <div className="media-select">
                    <div className="media-select__label-cast">
                        {_("popupMediaSelectCastLabel")}
                    </div>
                    <div className="select-wrapper">
                        <select
                            onChange={this.onSelectChange}
                            className="media-select__dropdown"
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
                    <div className="media-select__label-to">
                        {_("popupMediaSelectToLabel")}
                    </div>
                </div>
                <ul className="receivers">
                    {this.state.receiverDevices &&
                    this.state.receiverDevices.length ? (
                        this.state.receiverDevices.map((receiver, i) => (
                            <ReceiverEntry
                                receiverDevice={receiver}
                                onCast={this.onCast}
                                onStop={this.onStop}
                                isLoading={this.state.isLoading}
                                canCast={isSelectedMediaTypeAvailable}
                                key={i}
                            />
                        ))
                    ) : (
                        <div className="receivers__not-found">
                            {_("popupNoReceiversFound")}
                        </div>
                    )}
                </ul>
            </>
        );
    }

    private async onAddToWhitelist(app: KnownApp, pageInfo: PageInfo) {
        if (!app.matches) {
            return;
        }

        const whitelist = await options.get("userAgentWhitelist");
        if (!whitelist.includes(app.matches)) {
            whitelist.push(app.matches);
            await options.set("userAgentWhitelist", whitelist);

            await browser.tabs.reload(pageInfo.tabId);
            window.close();
        }
    }

    private onCast(receiverDevice: ReceiverDevice) {
        this.setState({
            isLoading: true
        });

        this.port?.postMessage({
            subject: "receiverSelector:selected",
            data: {
                receiverDevice,
                actionType: ReceiverSelectionActionType.Cast,
                mediaType: this.state.mediaType,
                filePath: this.state.filePath
            }
        });
    }

    private onStop(receiverDevice: ReceiverDevice) {
        this.port?.postMessage({
            subject: "receiverSelector:stop",
            data: {
                receiverDevice,
                actionType: ReceiverSelectionActionType.Stop
            }
        });
    }

    private onSelectChange(ev: React.ChangeEvent<HTMLSelectElement>) {
        const mediaType = parseInt(ev.target.value);

        if (mediaType === ReceiverSelectorMediaType.File) {
            const fileUrl = window.prompt();
            if (fileUrl) {
                this.setState({
                    mediaType,
                    filePath: fileUrl
                });

                return;
            }

            // Set media type to default if failed to set filePath
            if (this.defaultMediaType) {
                this.setState({
                    mediaType: this.defaultMediaType
                });
            }
        } else {
            this.setState({
                mediaType
            });
        }

        this.setState({
            filePath: undefined
        });
    }
}

interface ReceiverEntryProps {
    receiverDevice: ReceiverDevice;
    isLoading: boolean;
    canCast: boolean;
    onCast(receiverDevice: ReceiverDevice): void;
    onStop(receiverDevice: ReceiverDevice): void;
}

interface ReceiverEntryState {
    ellipsis: string;
    isLoading: boolean;
    showAlternateAction: boolean;
}

class ReceiverEntry extends Component<ReceiverEntryProps, ReceiverEntryState> {
    constructor(props: ReceiverEntryProps) {
        super(props);

        this.state = {
            ellipsis: "",
            isLoading: false,
            showAlternateAction: false
        };

        const handleActionKeyEvents = (ev: KeyboardEvent) => {
            if (ev.key === "Alt" || ev.key === "Shift") {
                this.setState({
                    // Only enable on keydown, otherwise disable
                    showAlternateAction: ev.type === "keydown"
                });
            }
        };

        window.addEventListener("keydown", handleActionKeyEvents);
        window.addEventListener("keyup", handleActionKeyEvents);

        window.addEventListener("blur", () => {
            this.setState({
                showAlternateAction: false
            });
        });

        this.handleCast = this.handleCast.bind(this);
    }

    public render() {
        const { status } = this.props.receiverDevice;
        const application = status?.applications?.[0];

        return (
            <li className="receiver">
                <div className="receiver__name">
                    {this.props.receiverDevice.friendlyName}
                </div>
                <div className="receiver__address">
                    {application && !application.isIdleScreen
                        ? application.statusText
                        : `${this.props.receiverDevice.host}:${this.props.receiverDevice.port}`}
                </div>
                <button
                    className="button receiver__connect"
                    onClick={this.handleCast}
                    disabled={
                        this.state.showAlternateAction
                            ? !application || application.isIdleScreen
                            : this.props.isLoading || !this.props.canCast
                    }
                >
                    {this.state.isLoading
                        ? _(
                              "popupCastingButtonTitle",
                              this.state.isLoading ? this.state.ellipsis : ""
                          )
                        : this.state.showAlternateAction
                        ? _("popupStopButtonTitle")
                        : _("popupCastButtonTitle")}
                </button>
            </li>
        );
    }

    private handleCast() {
        const { status } = this.props.receiverDevice;
        if (!status) {
            return;
        }

        const application = status.applications?.[0];

        if (this.state.showAlternateAction) {
            this.props.onStop(this.props.receiverDevice);
        } else {
            this.props.onCast(this.props.receiverDevice);

            this.setState({
                isLoading: true
            });

            setInterval(() => {
                this.setState(state => ({
                    ellipsis: getNextEllipsis(state.ellipsis)
                }));
            }, 500);
        }
    }
}

// Render after CSS has loaded
window.addEventListener("load", () => {
    ReactDOM.render(<PopupApp />, document.querySelector("#root"));
});
