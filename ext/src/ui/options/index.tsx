/* eslint-disable max-len */
"use strict";

import React, { Component } from "react";
import ReactDOM from "react-dom";

import defaultOptions from "../../defaultOptions";

import Bridge from "./Bridge";
import EditableList from "./EditableList";

import bridge, { BridgeInfo, BridgeTimedOutError } from "../../lib/bridge";
import logger from "../../lib/logger";
import options, { Options } from "../../lib/options";
import { REMOTE_MATCH_PATTERN_REGEX } from "../../lib/utils";


const _ = browser.i18n.getMessage;


// macOS styles
browser.runtime.getPlatformInfo()
    .then(platformInfo => {
        const link = document.createElement("link");
        link.rel = "stylesheet";

        switch (platformInfo.os) {
            case "mac": {
                link.href = "styles/mac.css";
                break;
            }
        }

        if (link.href) {
            document.head.appendChild(link);
        }
    });


function getInputValue(input: HTMLInputElement) {
    switch (input.type) {
        case "checkbox":
            return input.checked;
        case "number":
            return parseFloat(input.value);

        default:
            return input.value;
    }
}

interface OptionsAppProps {}
interface OptionsAppState {
    hasLoaded: boolean;
    bridgeLoading: boolean;
    bridgeLoadingTimedOut: boolean;
    isFormValid: boolean;
    hasSaved: boolean;

    options?: Options;
    bridgeInfo?: BridgeInfo;
    platform?: string;
}

class OptionsApp extends Component<
        OptionsAppProps, OptionsAppState> {

    private form: (HTMLFormElement | null) = null;

    state: OptionsAppState = {
        hasLoaded: false
      , bridgeLoading: true
      , bridgeLoadingTimedOut: false
      , isFormValid: true
      , hasSaved: false
    };

    constructor(props: OptionsAppProps) {
        super(props);

        this.handleReset = this.handleReset.bind(this);
        this.handleFormSubmit = this.handleFormSubmit.bind(this);
        this.handleFormChange = this.handleFormChange.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleWhitelistChange = this.handleWhitelistChange.bind(this);

        this.getWhitelistItemPatternError =
                this.getWhitelistItemPatternError.bind(this);
    }

    public async componentDidMount() {
        this.setState({
            hasLoaded: true
          , options: await options.getAll()
          , platform: (await browser.runtime.getPlatformInfo()).os
        });
        
        // Update options data if changed whilst page is open
        options.addEventListener("changed", async () => {
            this.setState({
                options: await options.getAll()
            });
        });

        try {
            const bridgeInfo = await bridge.getInfo();

            this.setState({
                bridgeInfo
              , bridgeLoading: false
            });
        } catch (err) {
            logger.error("Failed to fetch bridge/platform info.");

            if (err instanceof BridgeTimedOutError) {
                this.setState({
                    bridgeLoading: false
                  , bridgeLoadingTimedOut: true
                });
            } else {
                this.setState({
                    bridgeLoading: false
                });
            }
        }
    }

    public render() {
        if (!this.state.hasLoaded) {
            return;
        }

        return (
            <div>
                <form id="form" ref={ form => { this.form = form; }}
                      onSubmit={ this.handleFormSubmit }
                      onChange={ this.handleFormChange }>

                    <Bridge info={ this.state.bridgeInfo }
                            loading={ this.state.bridgeLoading }
                            loadingTimedOut={ this.state.bridgeLoadingTimedOut }
                            options={ this.state.options }
                            onChange={ this.handleInputChange } />

                    <fieldset className="category">
                        <legend className="category__name">
                            <h2>{ _("optionsMediaCategoryName") }</h2>
                        </legend>
                        <p className="category__description">
                            { _("optionsMediaCategoryDescription") }
                        </p>

                        <label className="option option--inline">
                            <div className="option__control">
                                <input name="mediaEnabled"
                                       type="checkbox"
                                       checked={ this.state.options?.mediaEnabled }
                                       onChange={ this.handleInputChange } />
                            </div>
                            <div className="option__label">
                                { _("optionsMediaEnabled") }
                            </div>
                        </label>

                        <label className="option option--inline">
                            <div className="option__control">
                                <input name="mediaSyncElement"
                                       type="checkbox"
                                       checked={ this.state.options?.mediaSyncElement }
                                       onChange={ this.handleInputChange } />
                            </div>
                            <div className="option__label">
                                { _("optionsMediaSyncElement") }
                            </div>
                            <div className="option__description">
                                { _("optionsMediaSyncElementDescription") }
                            </div>
                        </label>

                        <label className="option option--inline">
                            <div className="option__control">
                                <input name="mediaStopOnUnload"
                                       type="checkbox"
                                       checked={ this.state.options?.mediaStopOnUnload }
                                       onChange={ this.handleInputChange } />
                            </div>
                            <div className="option__label">
                                { _("optionsMediaStopOnUnload") }
                            </div>
                        </label>

                        <hr />

                        <label className="option option--inline">
                            <div className="option__control">
                                <input name="localMediaEnabled"
                                       type="checkbox"
                                       checked={ this.state.options?.localMediaEnabled }
                                       onChange={ this.handleInputChange } />
                            </div>
                            <div className="option__label">
                                { _("optionsLocalMediaEnabled") }
                            </div>
                            <div className="option__description">
                                { _("optionsLocalMediaCategoryDescription") }
                            </div>
                        </label>

                        <label className="option">
                            <div className="option__label">
                                { _("optionsLocalMediaServerPort") }
                            </div>
                            <div className="option__control">
                                <input name="localMediaServerPort"
                                       type="number"
                                       required
                                       min="1025"
                                       max="65535"
                                       value={ this.state.options?.localMediaServerPort }
                                       onChange={ this.handleInputChange } />
                            </div>
                        </label>
                    </fieldset>

                    <fieldset className="category">
                        <legend className="category__name">
                            <h2>{ _("optionsMirroringCategoryName") }</h2>
                        </legend>
                        <p className="category__description">
                            { _("optionsMirroringCategoryDescription") }
                        </p>

                        <label className="option option--inline">
                            <div className="option__control">
                                <input name="mirroringEnabled"
                                       type="checkbox"
                                       checked={ this.state.options?.mirroringEnabled }
                                       onChange={ this.handleInputChange } />
                            </div>
                            <div className="option__label">
                                { _("optionsMirroringEnabled") }
                            </div>
                        </label>

                        <label className="option">
                            <div className="option__label">
                                { _("optionsMirroringAppId") }
                            </div>
                            <div className="option__control">
                                <input name="mirroringAppId"
                                       type="text"
                                       required
                                       value={ this.state.options?.mirroringAppId }
                                       onChange={ this.handleInputChange } />
                                <div className="option__description">
                                    { _("optionsMirroringAppIdDescription") }
                                </div>
                            </div>
                        </label>
                    </fieldset>

                    <fieldset className="category">
                        <legend className="category__name">
                            <h2>{ _("optionsReceiverSelectorCategoryName") }</h2>
                        </legend>
                        <p className="category__description">
                            { _("optionsReceiverSelectorCategoryDescription") }
                        </p>

                        <label className="option option--inline">
                            <div className="option__control">
                                <input name="receiverSelectorWaitForConnection"
                                       type="checkbox"
                                       checked={ this.state.options?.receiverSelectorWaitForConnection }
                                       onChange={ this.handleInputChange } />
                            </div>
                            <div className="option__label">
                                { _("optionsReceiverSelectorWaitForConnection") }
                            </div>
                            <div className="option__description">
                                { _("optionsReceiverSelectorWaitForConnectionDescription") }
                            </div>
                        </label>

                        <label className="option option--inline">
                            <div className="option__control">
                                <input name="receiverSelectorCloseIfFocusLost"
                                       type="checkbox"
                                       checked={ this.state.options?.receiverSelectorCloseIfFocusLost }
                                       onChange={ this.handleInputChange } />
                            </div>
                            <div className="option__label">
                                { _("optionsReceiverSelectorCloseIfFocusLost") }
                            </div>
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
                            <div className="option__control">
                                <input name="userAgentWhitelistEnabled"
                                       type="checkbox"
                                       checked={ this.state.options?.userAgentWhitelistEnabled }
                                       onChange={ this.handleInputChange } />
                            </div>
                            <div className="option__label">
                                { _("optionsUserAgentWhitelistEnabled") }
                                <span className="option__recommended">
                                    { _("optionsOptionRecommended") }
                                </span>
                            </div>
                        </label>

                        <label className="option option--inline">
                            <div className="option__control">
                                <input name="userAgentWhitelistRestrictedEnabled"
                                       type="checkbox"
                                       checked={ this.state.options?.userAgentWhitelistRestrictedEnabled }
                                       onChange={ this.handleInputChange } />
                            </div>
                            <div className="option__label">
                                { _("optionsUserAgentWhitelistRestrictedEnabled") }
                                <span className="option__recommended">
                                    { _("optionsOptionRecommended") }
                                </span>
                            </div>
                            <div className="option__description">
                                { _("optionsUserAgentWhitelistRestrictedEnabledDescription") }
                            </div>
                        </label>

                        <div className="option">
                            <div className="option__label">
                                { _("optionsUserAgentWhitelistContent") }
                            </div>
                            <div className="option__control">
                                { this.state.options?.userAgentWhitelist &&
                                    <EditableList data={ this.state.options.userAgentWhitelist }
                                                  onChange={ this.handleWhitelistChange }
                                                  itemPattern={ REMOTE_MATCH_PATTERN_REGEX }
                                                  itemPatternError={ this.getWhitelistItemPatternError } /> }
                            </div>
                        </div>
                    </fieldset>

                    <div id="buttons">
                        <div id="status-line">
                            { this.state.hasSaved && _("optionsSaved") }
                        </div>
                        <button onClick={ this.handleReset }
                                type="button">
                            { _("optionsReset") }
                        </button>
                        <button type="submit"
                                // @ts-ignore
                                default
                                disabled={ !this.state.isFormValid }>
                            { _("optionsSave") }
                        </button>
                    </div>
                </form>
            </div>
        );
    }


    private handleReset() {
        this.setState({
            options: { ...defaultOptions }
        });
    }

    private async handleFormSubmit(ev: React.FormEvent<HTMLFormElement>) {
        ev.preventDefault();

        this.form?.reportValidity();

        try {
            if (this.state.options) {
                await options.setAll(this.state.options);

                this.setState({
                    hasSaved: true
                }, () => {
                    window.setTimeout(() => {
                        this.setState({
                            hasSaved: false
                        });
                    }, 1000);
                });
            }
        } catch (err) {
            logger.error("Failed to save options");
        }
    }

    private handleFormChange(ev: React.FormEvent<HTMLFormElement>) {
        ev.preventDefault();

        const isFormValid = this.form?.checkValidity();
        if (isFormValid !== undefined) {
            this.setState({
                isFormValid
            });
        }
    }

    private handleInputChange(ev: React.ChangeEvent<HTMLInputElement>) {
        this.setState(currentState => {
            if (currentState.options) {
                currentState.options[ev.target.name] = getInputValue(ev.target);
            }

            return currentState;
        });
    }

    private handleWhitelistChange(whitelist: string[]) {
        this.setState(currentState => {
            if (currentState.options) {
                currentState.options.userAgentWhitelist = whitelist;
            }

            return currentState;
        });
    }

    private getWhitelistItemPatternError(info: string): string {
        return _("optionsUserAgentWhitelistInvalidMatchPattern", info);
    }
}


ReactDOM.render(
    <OptionsApp />
  , document.querySelector("#root"));
