"use strict";

import React, { Component } from "react";
import ReactDOM from "react-dom";

import defaultOptions from "./defaultOptions";
import EditableList from "./EditableList";

import getBridgeInfo from "../lib/getBridgeInfo";


const _ = browser.i18n.getMessage;

// macOS styles
browser.runtime.getPlatformInfo()
    .then(platformInfo => {
        if (platformInfo.os === "mac") {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "styles/mac.css";
            document.head.appendChild(link);
        }
    });


const MATCH_PATTERN_REGEX = /^(?:(?:(\*|https?|ftp):\/\/((?:\*\.|[^\/\*])+)|(file):\/\/\/?(?:\*\.|[^\/\*])+)(\/.*)|<all_urls>)$/;

function getInputValue (input) {
    switch (input.type) {
        case "checkbox":
            return input.checked;
        case "number":
            return parseFloat(input.value);

        default:
            return input.value;
    }
}

class App extends Component {
    constructor (props) {
        super(props);

        this.state = {
            options: props.options
          , bridgeInfo: null
          , bridgeLoading: true
          , isFormValid: true
          , hasSaved: false
        };

        this.handleReset = this.handleReset.bind(this);
        this.handleFormSubmit = this.handleFormSubmit.bind(this);
        this.handleFormChange = this.handleFormChange.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleWhitelistChange = this.handleWhitelistChange.bind(this);

        this.getWhitelistItemPatternError
                = this.getWhitelistItemPatternError.bind(this);
    }

    async componentDidMount () {
        const bridgeInfo = await getBridgeInfo();
        this.setState({
            bridgeInfo
          , bridgeLoading: false
        });
    }

    /**
     * Set stored option values to current state
     */
    setStorage () {
        return browser.storage.sync.set({
            options: this.state.options
        });
    }

    handleReset () {
        this.setState({
            options: defaultOptions
        });

        // TODO: Propagate state properly
        this.form.submit();
    }

    async handleFormSubmit (ev) {
        ev.preventDefault();

        this.form.reportValidity();

        try {
            const { options: oldOptions }
                    = await browser.storage.sync.get("options");
            await this.setStorage();
            const { options } = await browser.storage.sync.get("options");

            const alteredOptions = [];

            for (const [ key, val ] of Object.entries(options)) {
                const oldVal = oldOptions[key];
                if (oldVal !== val) {
                    alteredOptions.push(key);
                }
            }

            this.setState({
                hasSaved: true
            }, () => {
                window.setTimeout(() => {
                    this.setState({
                        hasSaved: false
                    });
                }, 1000)
            });

            // Send update message / event
            browser.runtime.sendMessage({
                subject: "optionsUpdated"
              , data: { alteredOptions }
            });
        } catch (err) {}
    }

    handleFormChange () {
        this.setState({
            isFormValid: this.form.checkValidity()
        });
    }

    handleInputChange (ev) {
        const { target } = ev;

        this.setState(({ options }) => {
            options[target.name] = getInputValue(target);
            return { options };
        });
    }

    handleWhitelistChange (whitelist) {
        this.setState(({ options }) => {
            options.userAgentWhitelist = whitelist;
            return { options };
        });
    }

    getWhitelistItemPatternError (info) {
        return _("optionsUserAgentWhitelistInvalidMatchPattern", info);
    }

    async updateBridgeInfo () {
        this.setState({
            bridgeLoading: true
        });

        const bridgeInfo = await getBridgeInfo();

        this.setState({
            bridgeInfo
          , bridgeLoading: false
        });
    }

    render () {
        return (
            <div>

                <div className="bridge">
                    { do {
                        if (this.state.bridgeLoading) {
                            <div className="bridge__loading">
                                { _("optionsBridgeLoading") }
                                <progress></progress>
                            </div>
                        } else {
                            const { bridgeInfo } = this.state;

                            const bridgeInfoClasses = `bridge__info ${bridgeInfo
                                ? "bridge__info--found"
                                : "bridge__info--not-found"}`;

                            <div className={bridgeInfoClasses}>
                                <div className="bridge__status">
                                    <img className="bridge__status-icon"
                                         width="60" height="60"
                                         src={ bridgeInfo
                                                ? "assets/icons8-ok-120.png"
                                                : "assets/icons8-cancel-120.png" } />

                                    <h2 className="bridge__status-text">
                                        { bridgeInfo
                                            ? _("optionsBridgeFoundStatusText")
                                            : _("optionsBridgeNotFoundStatusText") }
                                    </h2>
                                </div>

                                { do { if (bridgeInfo) {
                                    <table className="bridge__stats">
                                        <tr>
                                            <th>{ _("optionsBridgeStatsVersion") }</th>
                                            <td>{ bridgeInfo.version }</td>
                                        </tr>
                                        <tr>
                                            <th>{ _("optionsBridgeStatsExpectedVersion") }</th>
                                            <td>{ APPLICATION_VERSION }</td>
                                        </tr>
                                        <tr>
                                            <th>{ _("optionsBridgeStatsCompatibility") }</th>
                                            <td>
                                                { bridgeInfo.isVersionCompatible
                                                    ? _("optionsBridgeCompatible")
                                                    : _("optionsBridgeIncompatible") }
                                            </td>
                                        </tr>
                                        <tr>
                                            <th>{ _("optionsBridgeStatsRecommendedAction") }</th>
                                            <td>
                                                { do {
                                                    if (bridgeInfo.isVersionOlder) {
                                                        _("optionsBridgeOlderAction")
                                                    } else if (bridgeInfo.isVersionNewer) {
                                                        _("optionsBridgeNewerAction")
                                                    } else {
                                                        _("optionsBridgeNoAction")
                                                    }
                                                }}
                                            </td>
                                        </tr>
                                    </table>
                                } else {
                                    // TODO: Download links
                                }}}
                            </div>
                        }
                    }}
                </div>

                <form id="form" ref={ form => { this.form = form; }}
                        onSubmit={ this.handleFormSubmit }
                        onChange={ this.handleFormChange }>

                    <fieldset className="category">
                        <legend className="category__name">
                            <h2>{ _("optionsMediaCategoryName") }</h2>
                        </legend>
                        <p className="category__description">
                            { _("optionsMediaCategoryDescription") }
                        </p>

                        <label className="option option--inline">
                            <input name="mediaEnabled"
                                   type="checkbox"
                                   checked={ this.state.options.mediaEnabled }
                                   onChange={ this.handleInputChange } />
                            <div className="option__label">
                                { _("optionsMediaEnabled") }
                            </div>
                        </label>

                        <fieldset className="category"
                                  disabled={ !this.state.options.mediaEnabled }>
                            <legend className="category__name">
                                <h2>{ _("optionsLocalMediaCategoryName") }</h2>
                            </legend>
                            <p className="category__description">
                                { _("optionsLocalMediaCategoryDescription") }
                            </p>

                            <label className="option option--inline">
                                <input name="localMediaEnabled"
                                       type="checkbox"
                                       checked={ this.state.options.localMediaEnabled }
                                       onChange={ this.handleInputChange } />
                                <div className="option__label">
                                    { _("optionsLocalMediaEnabled") }
                                </div>
                            </label>

                            <label className="option">
                                <div className="option__label">
                                    { _("optionsLocalMediaServerPort") }
                                </div>
                                <input name="localMediaServerPort"
                                       type="number"
                                       required
                                       min="1025"
                                       max="65535"
                                       value={ this.state.options.localMediaServerPort }
                                       onChange={ this.handleInputChange } />
                            </label>
                        </fieldset>
                    </fieldset>

                    <fieldset className="category">
                        <legend className="category__name">
                            <h2>{ _("optionsMirroringCategoryName") }</h2>
                        </legend>
                        <p className="category__description">
                            { _("optionsMirroringCategoryDescription") }
                        </p>

                        <label className="option option--inline">
                            <input name="mirroringEnabled"
                                   type="checkbox"
                                   checked={ this.state.options.mirroringEnabled }
                                   onChange={ this.handleInputChange } />
                            <div className="option__label">
                                { _("optionsMirroringEnabled") }
                            </div>
                        </label>

                        <label className="option">
                            <div className="option__label">
                                { _("optionsMirroringAppId") }
                            </div>
                            <input name="mirroringAppId"
                                   type="text"
                                   required
                                   value={ this.state.options.mirroringAppId }
                                   onChange={ this.handleInputChange } />
                        </label>
                    </fieldset>

                    <fieldset className="category">
                        <legend className="category__name">
                            <h2>{ _("optionsUserAgentWhitelistCategoryName") }</h2>
                        </legend>
                        <p className="category__description">
                            { _("optionsUserAgentWhitelistCategoryDescription") }
                        </p>

                        <label className="option option--inline">
                            <input name="userAgentWhitelistEnabled"
                                   type="checkbox"
                                   checked={ this.state.options.userAgentWhitelistEnabled }
                                   onChange={ this.handleInputChange } />
                            <div className="option__label">
                                { _("optionsUserAgentWhitelistEnabled") }
                            </div>
                        </label>

                        <div className="option">
                            <div className="option__label">
                                { _("optionsUserAgentWhitelistContent") }
                            </div>
                            <EditableList data={ this.state.options.userAgentWhitelist }
                                          onChange={ this.handleWhitelistChange }
                                          itemPattern={ MATCH_PATTERN_REGEX }
                                          itemPatternError={ this.getWhitelistItemPatternError } />
                        </div>
                    </fieldset>

                    <div id="buttons">
                        <div id="status-line">
                            { do {
                                if (this.state.hasSaved) {
                                    _("optionsSaved")
                                }
                            }}
                        </div>
                        <button onClick={ this.handleReset }>
                            { _("optionsReset") }
                        </button>
                        <button type="submit"
                                default
                                disabled={ !this.state.isFormValid }>
                            { _("optionsSave") }
                        </button>
                    </div>
                </form>
            </div>
        );
    }
}


(async () => {
    const { options } = await browser.storage.sync.get("options");

    ReactDOM.render(
        <App options={options} />
      , document.querySelector("#root"));
})()
