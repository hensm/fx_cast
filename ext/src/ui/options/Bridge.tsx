/* tslint:disable:max-line-length */
"use strict";

import React, { Component } from "react";
import semver from "semver";

import options from "../../lib/options";

import { BridgeInfo } from "../../lib/bridge";
import { getNextEllipsis } from "../../lib/utils";


const _ = browser.i18n.getMessage;


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
    info?: BridgeInfo;
    loading: boolean;
}

interface BridgeState {
    isCheckingUpdates: boolean;
    isUpdateAvailable: boolean;
    wasErrorCheckingUpdates: boolean;
    checkUpdatesEllipsis: string;
    bridgeBackupEnabled?: boolean;
    updateStatus?: string;
}

export default class Bridge extends Component<BridgeProps, BridgeState> {
    private updateData: any;
    private updateStatusTimeout?: number;

    constructor (props: BridgeProps) {
        super(props);

        this.state = {
            isCheckingUpdates: false
          , isUpdateAvailable: false
          , wasErrorCheckingUpdates: false
          , checkUpdatesEllipsis: "..."
        };

        options.get("bridgeBackupEnabled")
            .then(bridgeBackupEnabled => {
                this.setState({ bridgeBackupEnabled });
            });

        this.onCheckUpdates = this.onCheckUpdates.bind(this);
        this.onCheckUpdatesResponse = this.onCheckUpdatesResponse.bind(this);
        this.onCheckUpdatesError = this.onCheckUpdatesError.bind(this);
        this.onUpdate = this.onUpdate.bind(this);
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

                { !this.props.loading && this.state.bridgeBackupEnabled !== undefined &&
                    <div className="bridge__options">
                        <label className="option option--inline">
                            <div className="option__control">
                                <input name="bridgeBackupEnabled"
                                       type="checkbox"
                                       checked={ this.state.bridgeBackupEnabled }
                                       onChange={ ev => {
                                           options.set("bridgeBackupEnabled"
                                                 , ev.target.checked);
                                       }} />
                            </div>
                            <div className="option__label">
                                { _("optionsBridgeBackupEnabled") }
                            </div>
                            <div className="option__description">
                                { _("optionsBridgeBackupEnabledDescription") }
                            </div>
                        </label>
                    </div> }

                { !this.props.loading &&
                    <div className="bridge__update-info">
                        { this.state.isUpdateAvailable
                            ? ( <div className="bridge__update">
                                    <p className="bridge__update-label">
                                        { _("optionsBridgeUpdateAvailable") }
                                    </p>
                                    <div className="bridge__update-options">
                                        <button className="bridge__update-start"
                                                onClick={ this.onUpdate }>
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
        let statusText: (string | null);

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

            statusText = null;
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

        fetch("https://api.github.com/repos/hensm/fx_cast/releases/latest")
            .then(res => {
                window.clearTimeout(timeout);
                return res.json();
            })
            .then(this.onCheckUpdatesResponse)
            .catch(this.onCheckUpdatesError);
    }

    private async onCheckUpdatesResponse (res: any) {
        const isUpdateAvailable = !this.props.info ||
                semver.lt(this.props.info.version, res.tag_name);

        if (isUpdateAvailable) {
            this.updateData = res;
        }

        this.setState({
            isCheckingUpdates: false
          , isUpdateAvailable
        });

        if (!isUpdateAvailable) {
            this.setState({
                updateStatus: _("optionsBridgeUpdateStatusNoUpdates")
            });
        }

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

    private showUpdateStatus () {
        if (this.updateStatusTimeout) {
            window.clearTimeout(this.updateStatusTimeout);
        }
        this.updateStatusTimeout = window.setTimeout(() => {
            this.setState({
                updateStatus: undefined
            });
        }, 1500);
    }

    private async onUpdate () {
        // Open downloads page
        if (this.updateData.html_url) {
            browser.tabs.create({
                url: this.updateData.html_url
            });
        }
    }
}
