/* tslint:disable:max-line-length */
"use strict";

import React, { Component } from "react";
import semver from "semver";

import { getNextEllipsis
       , getWindowCenteredProps } from "../../lib/utils";

import { BridgeInfo } from "../../lib/getBridgeInfo";

const _ = browser.i18n.getMessage;

const ENDPOINT_URL = "https://api.github.com/repos/hensm/fx_cast/releases/latest";


async function downloadApp (info: any, platform: string) {
    const download = browser.downloads.download({
        filename: info[platform].name
      , url: info[platform].url
    });
}


interface BridgeDownloadsProps {
    info: any;
}

const BridgeDownloads = (props: BridgeDownloadsProps) => (
    <div className="bridge-downloads">
        <button className="bridge-downloads__download
                           bridge-downloads__win"
                disabled
                onClick={ () => downloadApp(props.info, "win") }>
            Windows
        </button>
        <button className="bridge-downloads__download
                           bridge-downloads__mac"
                onClick={ () => downloadApp(props.info, "mac") }>
            macOS
        </button>

        <div className="bridge-downloads__linux">
            <button className="bridge-downloads__download"
                    onClick={ () => downloadApp(props.info, "deb") }>
                Linux (deb)
            </button>
            <button className="bridge-downloads__download"
                    onClick={ () => downloadApp(props.info, "rpm") }>
                Linux (rpm)
            </button>
        </div>
    </div>
);


interface BridgeStatsProps {
    info: BridgeInfo;
}

const BridgeStats = (props: BridgeStatsProps) => (
    <table className="bridge__stats">
        <tr>
            <th>{ _("optionsBridgeStatsName") }</th>
            <td>{ props.info.name }</td>
        </tr>
        <tr>
            <th>{ _("optionsBridgeStatsVersion") }</th>
            <td>{ props.info.version }</td>
        </tr>
        <tr>
            <th>{ _("optionsBridgeStatsExpectedVersion") }</th>
            <td>{ props.info.expectedVersion }</td>
        </tr>
        <tr>
            <th>{ _("optionsBridgeStatsCompatibility") }</th>
            <td>
                { props.info.isVersionCompatible
                    ? props.info.isVersionExact
                        ? _("optionsBridgeCompatible")
                        : _("optionsBridgeLikelyCompatible")
                    : _("optionsBridgeIncompatible") }
            </td>
        </tr>
        <tr>
            <th>{ _("optionsBridgeStatsRecommendedAction") }</th>
            <td>
                {    // If older
                    props.info.isVersionOlder
                        ? _("optionsBridgeOlderAction")
                    // else if newer
                  : props.info.isVersionNewer
                        ? _("optionsBridgeNewerAction")
                    // else
                        : _("optionsBridgeNoAction")
                }
            </td>
        </tr>
    </table>
);


interface BridgeProps {
    info: BridgeInfo;
    platform: string;
    loading: boolean;
}

interface BridgeState {
    isCheckingUpdates: boolean;
    isUpdateAvailable: boolean;
    wasErrorCheckingUpdates: boolean;
    checkUpdatesEllipsis: string;
    updateStatus: string;
    packageType: string;
}

export default class Bridge extends Component<BridgeProps, BridgeState> {
    private updateData: any;
    private updateStatusTimeout: number;

    constructor (props: BridgeProps) {
        super(props);

        this.state = {
            isCheckingUpdates: false
          , isUpdateAvailable: false
          , wasErrorCheckingUpdates: false
          , checkUpdatesEllipsis: "..."
          , updateStatus: null
          , packageType: null
        };

        this.onCheckUpdates = this.onCheckUpdates.bind(this);
        this.onCheckUpdatesResponse = this.onCheckUpdatesResponse.bind(this);
        this.onCheckUpdatesError = this.onCheckUpdatesError.bind(this);
        this.onUpdate = this.onUpdate.bind(this);
        this.onPackageTypeChange = this.onPackageTypeChange.bind(this);
    }

    public render () {
        return (
            <div className="bridge">
                { this.props.loading
                    ? ( <div className="bridge__loading">
                            { _("optionsBridgeLoading") }
                            <progress></progress>
                        </div> )
                    : this.renderStatus() }

                { !this.props.loading &&
                    <div className="bridge__update-info">
                        { this.state.isUpdateAvailable
                            ? ( <div className="bridge__update">
                                    <p className="bridge__update-label">
                                        { _("optionsBridgeUpdateAvailable") }
                                    </p>
                                    <div className="bridge__update-options">
                                        { this.props.platform === "linux" &&
                                            <select className="bridge__update-package-type"
                                                    onChange={ this.onPackageTypeChange }
                                                    value={ this.state.packageType }>
                                                <option value="" disabled selected>
                                                    { _("optionsBridgeUpdatePackageTypeSelect") }
                                                </option>
                                                <option value="deb">
                                                    { _("optionsBridgeUpdatePackageTypeDeb") }
                                                </option>
                                                <option value="rpm">
                                                    { _("optionsBridgeUpdatePackageTypeRpm") }
                                                </option>
                                            </select> }
                                        <button className="bridge__update-start"
                                                onClick={ this.onUpdate }
                                                disabled={ this.props.platform === "linux"
                                                        && !this.state.packageType }>
                                            { _("optionsBridgeUpdate") }
                                        </button>
                                    </div>
                                </div> )
                            : ( <button className="bridge__update-check"
                                        disabled={ this.state.isCheckingUpdates }
                                        onClick={ this.onCheckUpdates }>

                                    { this.state.isCheckingUpdates
                                        ? _("optionsBridgeUpdateChecking"
                                              , getNextEllipsis(this.state.checkUpdatesEllipsis))
                                        : _("optionsBridgeUpdateCheck") }
                                </button> )}

                        <div className="bridge--update-status">
                            { this.state.updateStatus && !this.state.isUpdateAvailable
                                    && this.state.updateStatus }
                        </div>
                    </div> }
            </div>
        );
    }

    private renderStatus () {
        const infoClasses = `bridge__info ${this.props.info
            ? "bridge__info--found"
            : "bridge__info--not-found"}`;

        let statusIcon: string;
        let statusTitle: string;
        let statusText: string;

        if (!this.props.info) {
            statusIcon = "assets/icons8-cancel-120.png";
            statusTitle = _("optionsBridgeNotFoundStatusTitle");
            statusText = _("optionsBridgeNotFoundStatusText");
        } else {
            if (this.props.info.isVersionCompatible) {
                statusIcon = "assets/icons8-ok-120.png";
                statusTitle = _("optionsBridgeFoundStatusTitle");
            } else {
                statusIcon = "assets/icons8-warn-120.png";
                statusTitle = _("optionsBridgeIssueStatusTitle");
            }
        }

        return (
            <div className={infoClasses}>
                <div className="bridge__status">
                    <img className="bridge__status-icon"
                         width="60" height="60"
                         src={ statusIcon } />

                    <h2 className="bridge__status-title">
                        { statusTitle }
                    </h2>

                    { statusText &&
                        <p className="bridge__status-text">
                            { statusText }
                        </p> }
                </div>

                { this.props.info &&
                    <BridgeStats info={ this.props.info }/> }
            </div>
        );
    }

    private onCheckUpdates () {
        this.setState({
            isCheckingUpdates: true
        });

        const timeout = window.setInterval(() => {
            this.setState(state => ({
                checkUpdatesEllipsis: getNextEllipsis(
                        state.checkUpdatesEllipsis)
            }));
        }, 500);

        fetch(ENDPOINT_URL)
            .then(res => {
                window.clearTimeout(timeout);
                return res.json();
            })
            .then(this.onCheckUpdatesResponse)
            .catch(this.onCheckUpdatesError);
    }

    private showUpdateStatus () {
        if (this.updateStatusTimeout) {
            window.clearTimeout(this.updateStatusTimeout);
        }
        this.updateStatusTimeout = window.setTimeout(() => {
            this.setState({
                updateStatus: null
            });
        }, 1500);
    }

    private async onUpdate () {
        // Current window to base centered position on
        const win = await browser.windows.getCurrent();
        const centeredProps = getWindowCenteredProps(win, 400, 150);

        const updaterPopup = await browser.windows.create({
            url: "../updater/index.html"
          , type: "popup"
          , ...centeredProps
        });

        // Size/position not set correctly on creation (bug?)
        await browser.windows.update(updaterPopup.id, {
            ...centeredProps
        });

        browser.runtime.onConnect.addListener(port => {
            if (port.name === "updater") {
                const asset = this.updateData.assets.find((currentAsset: any) => {
                    const fileExtension = currentAsset.name.match(/.*\.(.*)$/).pop();
                    const currentPlatform = (this.props.platform === "linux")
                        ? this.state.packageType
                        : this.props.platform;

                    switch (fileExtension) {
                        case "exe": return "win" === currentPlatform;
                        case "pkg": return "mac" === currentPlatform;
                        case "deb": return "deb" === currentPlatform;
                        case "rpm": return "rpm" === currentPlatform;
                    }
                });

                port.postMessage({
                    subject: "updater:/updateData"
                  , data: asset
                });

                port.onDisconnect.addListener(() => {
                    browser.windows.remove(updaterPopup.id);
                });
            }
        });
    }


    private async onCheckUpdatesResponse (res: any) {
        const isUpdateAvailable = !this.props.info || semver.lt(
                this.props.info.version, res.tag_name);

        if (isUpdateAvailable) {
            this.updateData = res;
        }

        this.setState({
            isCheckingUpdates: false
          , isUpdateAvailable
          , updateStatus: !isUpdateAvailable
                ? _("optionsBridgeUpdateStatusNoUpdates")
                : null
        });

        this.showUpdateStatus();
    }

    private onCheckUpdatesError () {
        this.setState({
            isCheckingUpdates: false
          , wasErrorCheckingUpdates: true
          , updateStatus: _("optionsBridgeUpdateStatusError")
        });

        this.showUpdateStatus();
    }

    private onPackageTypeChange (ev: React.ChangeEvent<HTMLSelectElement>) {
        this.setState({
            packageType: ev.target.value
        });
    }
}
