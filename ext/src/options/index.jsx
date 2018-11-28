"use strict";

import React, { Component } from "react";
import ReactDOM from "react-dom";

import defaultOptions from "./defaultOptions";
import EditableList from "./EditableList";


const _ = browser.i18n.getMessage;


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
          , isFormValid: true
        };

        this.handleReset = this.handleReset.bind(this);
        this.handleFormSubmit = this.handleFormSubmit.bind(this);
        this.handleFormChange = this.handleFormChange.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleWhitelistChange = this.handleWhitelistChange.bind(this);

        this.getWhitelistItemPatternError
                = this.getWhitelistItemPatternError.bind(this);
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

    render () {
        return (
            <form id="form" ref={ form => { this.form = form; }}
                    onSubmit={ this.handleFormSubmit }
                    onChange={ this.handleFormChange }>
                <fieldset className="category">
                    <legend className="category__name">
                        { _("optionsMediaCategoryName") }
                    </legend>
                    <p className="category__description">
                        { _("optionsMediaCategoryDescription") }
                    </p>

                    <label className="option">
                        <div className="option__label">
                            { _("optionsMediaEnabled") }
                        </div>
                        <input name="mediaEnabled"
                               type="checkbox"
                               checked={ this.state.options.mediaEnabled }
                               onChange={ this.handleInputChange } />
                    </label>

                    <fieldset className="category">
                        <legend className="category__name">
                            { _("optionsLocalMediaCategoryName") }
                        </legend>
                        <p className="category__description">
                            { _("optionsLocalMediaCategoryDescription") }
                        </p>

                        <label className="option">
                            <div className="option__label">
                                { _("optionsLocalMediaEnabled") }
                            </div>
                            <input name="localMediaEnabled"
                                   type="checkbox"
                                   checked={ this.state.options.localMediaEnabled }
                                   onChange={ this.handleInputChange } />
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
                        { _("optionsMirroringCategoryName") }
                    </legend>
                    <p className="category__description">
                        { _("optionsMirroringCategoryDescription") }
                    </p>

                    <label className="option">
                        <div className="option__label">
                            { _("optionsMirroringEnabled") }
                        </div>
                        <input name="mirroringEnabled"
                               type="checkbox"
                               checked={ this.state.options.mirroringEnabled }
                               onChange={ this.handleInputChange } />
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
                        { _("optionsUserAgentWhitelistCategoryName") }
                    </legend>
                    <p className="category__description">
                        { _("optionsUserAgentWhitelistCategoryDescription") }
                    </p>

                    <label className="option">
                        <div className="option__label">
                            { _("optionsUserAgentWhitelistEnabled") }
                        </div>
                        <input name="userAgentWhitelistEnabled"
                               type="checkbox"
                               checked={ this.state.options.userAgentWhitelistEnabled }
                               onChange={ this.handleInputChange } />
                    </label>

                    <div className="option">
                        <div className="option__label">
                            { _("optionsUserAgentWhitelistContent") }
                        </div>
                        <EditableList data={ this.state.options.userAgentWhitelist }
                                      onChange={ this.handleWhitelistChange }
                                      itemPattern={ MATCH_PATTERN_REGEX }
                                      itemPatternError={ this.getWhitelistItemPatternError }/>
                    </div>
                </fieldset>

                <div id="buttons">
                    <button onClick={ this.handleReset }>
                        { _("optionsReset") }
                    </button>
                    <button type="submit"
                            disabled={ !this.state.isFormValid }>
                        { _("optionsSubmit") }
                    </button>
                </div>
            </form>
        );
    }
}


browser.storage.sync.get("options").then(({options}) => {
    ReactDOM.render(
        <App options={options} />
      , document.querySelector("#root"));
});
