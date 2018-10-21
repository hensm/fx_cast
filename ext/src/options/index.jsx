"use strict";

import React, { Component } from "react";
import ReactDOM             from "react-dom";


const _ = browser.i18n.getMessage;


class OptionsApp extends Component {
    constructor (props) {
        super(props);

        this.state = {
            isFormValid: true
        };

        this.handleFormSubmit  = this.handleFormSubmit.bind(this);
        this.handleFormChange  = this.handleFormChange.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
    }

    /**
     * Set stored option values to current state
     */
    setStorage () {
        return browser.storage.sync.set({
            options: {
                option_localMediaEnabled: this.state.option_localMediaEnabled
              , option_localMediaServerPort: this.state.option_localMediaServerPort
              , option_uaWhitelistEnabled: this.state.option_uaWhitelistEnabled
              , option_uaWhitelist: this.state.option_uaWhitelist
            }
        });
    }

    /**
     * Get current options state from storage and set initial
     */
    async componentDidMount () {
        const { options } = await browser.storage.sync.get("options");

        if (options) {
            this.setState({
                ...options
              , isFormValid: this.form.checkValidity()
            });
        } else {
            try {
                await this.setStorage();
            } catch (err) {
                // TODO
            }
        }
    }


    async handleFormSubmit (ev) {
        ev.preventDefault();

        this.form.reportValidity();

        try {
            await this.setStorage();
        } catch (err) {}
    }

    handleFormChange () {
        this.setState({
            isFormValid: this.form.checkValidity()
        });
    }

    
    handleInputChange (ev) {
        const val = do {
            if (ev.target.type === "checkbox") {
                ev.target.checked;
            } else if (ev.target.type === "number") {
                parseInt(ev.target.value);
            } else {
                ev.target.value;
            }
        };

        this.setState({
            [ ev.target.name ]: val
        });
    }

    render () {
        return (
            <form id="form" ref={ form => { this.form = form; }}
                    onSubmit={ this.handleFormSubmit }
                    onChange={ this.handleFormChange }>
                <fieldset className="category">
                    <legend className="category-name">
                        { _("options_category_localMedia") }
                    </legend>
                    <p className="category-description">
                        { _("options_category_localMedia_description") }
                    </p>

                    <label className="option">
                        <div className="option-label">
                            { _("options_option_localMediaEnabled") }
                        </div>
                        <input name="option_localMediaEnabled"
                               type="checkbox"
                               checked={ this.state.option_localMediaEnabled }
                               onChange={ this.handleInputChange } />
                    </label>

                    <label className="option">
                        <div className="option-label">
                            { _("options_option_localMediaServerPort") }
                        </div>
                        <input name="option_localMediaServerPort"
                               type="number"
                               required
                               min="1025"
                               max="65535"
                               value={ this.state.option_localMediaServerPort }
                               onChange={ this.handleInputChange } />
                    </label>
                </fieldset>

                <fieldset className="category">
                    <legend className="category-name">
                        { _("options_category_uaWhitelist") }
                    </legend>
                    <p className="category-description">
                        { _("options_category_uaWhitelist_description") }
                    </p>

                    <label className="option">
                        <div className="option-label">
                            { _("options_option_uaWhitelistEnabled") }
                        </div>
                        <input name="option_uaWhitelistEnabled"
                               type="checkbox"
                               checked={ this.state.option_uaWhitelistEnabled }
                               onChange={ this.handleInputChange } />
                    </label>

                    <label className="option">
                        <div className="option-label">
                            { _("options_option_uaWhitelist") }
                        </div>
                        <textarea name="option_uaWhitelist"
                               value={this.state.option_uaWhitelist}
                               required
                               onChange={ this.handleInputChange }>
                        </textarea>
                    </label>
                </fieldset>

                <div id="buttons">
                    <button type="submit"
                            disabled={ !this.state.isFormValid }>
                        { _("options_submit") }
                    </button>
                </div>
            </form>
        );
    }
}


ReactDOM.render(
    <OptionsApp />
  , document.querySelector("#root"));
