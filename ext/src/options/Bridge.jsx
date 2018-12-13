import React, { Component } from "react";

const _ = browser.i18n.getMessage;

const BridgeStats = (props) => (
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
                { do {
                    if (props.info.isVersionCompatible) {
                        if (props.info.isVersionExact) {
                            _("optionsBridgeCompatible")
                        } else {
                            _("optionsBridgeLikelyCompatible")
                        }
                    } else {
                        _("optionsBridgeIncompatible")
                    }
                }}
            </td>
        </tr>
        <tr>
            <th>{ _("optionsBridgeStatsRecommendedAction") }</th>
            <td>
                { do {
                    if (props.info.isVersionOlder) {
                        _("optionsBridgeOlderAction")
                    } else if (props.info.isVersionNewer) {
                        _("optionsBridgeNewerAction")
                    } else {
                        _("optionsBridgeNoAction")
                    }
                }}
            </td>
        </tr>
    </table>
);

export default (props) => (
    <div className="bridge">
        { do {
            if (props.loading) {
                <div className="bridge__loading">
                    { _("optionsBridgeLoading") }
                    <progress></progress>
                </div>
            } else {
                const infoClasses = `bridge__info ${props.info
                    ? "bridge__info--found"
                    : "bridge__info--not-found"}`;

                const [ statusIcon, statusText ] = do {
                    if (!props.info) {
                        [ "assets/icons8-cancel-120.png"
                          , _("optionsBridgeNotFoundStatusText") ]
                    } else {
                        if (props.info.isVersionCompatible) {
                            [ "assets/icons8-ok-120.png"
                              , _("optionsBridgeFoundStatusText") ]
                        } else {
                            [ "assets/icons8-warn-120.png"
                              , _("optionsBridgeIssueStatusText") ]
                        }
                    }
                };

                <div className={infoClasses}>
                    <div className="bridge__status">
                        <img className="bridge__status-icon"
                             width="60" height="60"
                             src={ statusIcon } />

                        <h2 className="bridge__status-text">
                            { statusText }
                        </h2>
                    </div>

                    { do {
                        if (props.info) {
                            <BridgeStats info={ props.info }/>
                        } else {
                            // TODO: Download links
                        }
                    }}
                </div>
            }
        }}
    </div>
);
