"use strict";

import React, { Component } from "react";
import ReactDOM             from "react-dom";


const _ = browser.i18n.getMessage;


const MATCH_PATTERN_REGEX = /^(?:(?:(\*|https?|ftp):\/\/((?:\*\.|[^\/\*])+)|(file):\/\/\/?(?:\*\.|[^\/\*])+)(\/.*)|<all_urls>)$/;

class EditableListItem extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            editing: this.props.editing || false
          , editValue: ""
        };

        this.handleRemove = this.handleRemove.bind(this);
        this.handleEditBegin = this.handleEditBegin.bind(this);
        this.handleEditEnd = this.handleEditEnd.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleInputKeyPress = this.handleInputKeyPress.bind(this);
    }

    handleRemove () {
        this.props.onRemove(this.props.text);
    }

    handleEditBegin () {
        this.setState({
            editing: true
          , editValue: this.props.text
        });
    }

    handleEditEnd (ev) {
        if (this.props.editing
                && !this.props.itemPattern.test(this.state.editValue)) {
            ev.target.setCustomValidity(this.props.itemPatternError());
        }

        if (!ev.target.validity.valid) {
            return;
        }

        this.props.onEdit(this.props.text, this.state.editValue);
        this.setState({
            editing: false
          , editValue: ""
        });
    }

    handleInputChange (ev) {
        this.setState({
            editValue: ev.target.value
        });
        
        if (!this.props.itemPattern.test(ev.target.value)) {
            ev.target.setCustomValidity(this.props.itemPatternError());        
        } else {
            ev.target.setCustomValidity("");
        }
    }

    handleInputKeyPress (ev) {
        if (ev.key === "Enter") {
            this.handleEditEnd({ target: ev.target });
        }
    }

    render () {
        return (
            <li className="editable-list__item">
                <div className="editable-list__title"
                     onDoubleClick={ this.handleEditBegin }>
                    { this.state.editing
                        ? <input className="editable-list__edit-field"
                                 type="text"
                                 autoFocus
                                 value={ this.state.editValue }
                                 onBlur={ this.handleEditEnd }
                                 onChange={ this.handleInputChange }
                                 onKeyPress={ this.handleInputKeyPress }/>
                        : this.props.text }
                </div>
                <button onClick={ this.handleEditBegin }>
                    { _("options_option_uaWhitelistItemEdit") }
                </button>
                <button onClick={ this.handleRemove }>
                    { _("options_option_uaWhitelistItemRemove") }
                </button>
            </li>
        );
    }
}

class EditableList extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            items: new Set(this.props.data)
          , addingNewItem: false
          , rawView: false
          , rawViewValue: ""
        };

        this.handleItemRemove = this.handleItemRemove.bind(this);
        this.handleItemEdit = this.handleItemEdit.bind(this);
        this.handleSwitchView = this.handleSwitchView.bind(this);
        this.handleSaveRaw = this.handleSaveRaw.bind(this);
        this.handleRawViewTextAreaChange = this.handleRawViewTextAreaChange.bind(this);
        this.handleAddItem = this.handleAddItem.bind(this);
        this.handleNewItemRemove = this.handleNewItemRemove.bind(this);
        this.handleNewItemEdit = this.handleNewItemEdit.bind(this);
    }

    handleItemRemove (item) {
        this.setState(currentState => {
            const newItems = new Set(currentState.items);
            newItems.delete(item);
            return {
                items: newItems
            };
        }, () => {
            this.props.onListChange(Array.from(this.state.items));
        });
    }

    handleItemEdit (item, newValue) {
        this.setState(currentState => ({
            items: new Set([...currentState.items]
                    .map(item_ => item_ === item ? newValue : item_))
        }), () => {
            this.props.onListChange(Array.from(this.state.items));
        });
    }

    handleSwitchView () {
        this.setState(currentState => {
            if (currentState.rawView) {
                return {
                    rawView: false
                  , rawViewValue: ""
                };
            }
            
            return {
                rawView: true
              , rawViewValue: [...currentState.items.values()].join("\n")
            };
        });
    }

    handleSaveRaw () {
        this.setState(currentState => {
            console.log(currentState.rawViewValue);
            const newItems = currentState.rawViewValue.split("\n")
                .filter(item => item !== "");

            if ("itemPattern" in this.props) {
                for (const item of newItems) {
                    if (!this.props.itemPattern.test(item)) {
                        this.rawViewTextArea.setCustomValidity(
                                this.props.itemPatternError(item));
                        return;
                    }
                }

                this.rawViewTextArea.setCustomValidity("");           
            }

            return {
                items: new Set(newItems)
            };
        }, () => {
            this.props.onListChange(Array.from(this.state.items));
        });
    }

    handleRawViewTextAreaChange (ev) {
        if (this.rawViewTextArea.scrollHeight > this.rawViewTextArea.clientHeight) {
            this.rawViewTextArea.style.height = `${this.rawViewTextArea.scrollHeight}px`;
        }

        this.setState({
            rawViewValue: ev.target.value
        });
    }

    handleAddItem () {
        this.setState({
            addingNewItem: true
        });
    }

    handleNewItemRemove () {
        this.setState({
            addingNewItem: false
        });
    }

    handleNewItemEdit (item, newItem) {
        this.setState(currentState => ({
            items: [ ...currentState.items, newItem ]
          , addingNewItem: false
        }), () => {
            this.props.onListChange(Array.from(this.state.items));
        });
    }

    render () {
        const items = Array.from(this.state.items.values());

        return (
            <div className="editable-list">
                <button className="editable-list__view-button"
                        onClick={ this.handleSwitchView }>
                    { this.state.rawView
                        ? _("options_option_uaWhitelistBasicView")
                        : _("options_option_uaWhitelistRawView") }
                </button>
                { this.state.rawView &&
                    <button className="editable-list__save-raw-button"
                            onClick={ this.handleSaveRaw }>
                        { _("options_option_uaWhitelistSaveRaw") }
                    </button> }
                <hr />
                {
                    this.state.rawView
                        ? ( <textarea className="editable-list__raw-view"
                                      rows={ items.length}
                                      value={ this.state.rawViewValue}
                                      onChange={ this.handleRawViewTextAreaChange }
                                      ref={ el => { this.rawViewTextArea = el }}>
                            </textarea> )
                        : ( <ul className="editable-list__items">
                                { items.map((item, i) => 
                                    <EditableListItem text={ item }
                                                      itemPattern={ this.props.itemPattern }
                                                      itemPatternError={ this.props.itemPatternError }
                                                      onRemove={ this.handleItemRemove }
                                                      onEdit={ this.handleItemEdit }
                                                      key={ i } /> )}
                                { this.state.addingNewItem &&
                                    <EditableListItem text=""
                                                      itemPattern={ this.props.itemPattern }
                                                      itemPatternError={ this.props.itemPatternError }
                                                      onRemove={ this.handleNewItemRemove }
                                                      onEdit={ this.handleNewItemEdit }
                                                      editing={ true } /> }
                                <div className="editable-list__item editable-list__item-actions">
                                    <button className="editable-list__add-button"
                                            onClick={ this.handleAddItem }>
                                        { _("options_option_uaWhitelistAddItem") }
                                    </button>
                                </div>
                            </ul> )
                }
            </div>
        );
    }
}

class OptionsApp extends Component {
    constructor (props) {
        super(props);

        this.state = {
            ...props.options
          , isFormValid: true
        };

        this.handleFormSubmit = this.handleFormSubmit.bind(this);
        this.handleFormChange = this.handleFormChange.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleListChange = this.handleListChange.bind(this);
        this.getItemPatternError = this.getItemPatternError.bind(this);
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

    async handleFormSubmit (ev) {
        ev.preventDefault();

        this.form.reportValidity();

        try {
            const { options: oldOptions } = await browser.storage.sync.get("options");
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

    handleListChange (data) {
        this.setState({
            option_uaWhitelist: data
        });
    }

    getItemPatternError (info) {
        return _("options_option_uaWhitelistInvalidMatchPattern", info);
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
                        <EditableList data={ this.state.option_uaWhitelist }
                                      onListChange={ this.handleListChange }
                                      itemPattern={ MATCH_PATTERN_REGEX }
                                      itemPatternError={ this.getItemPatternError }/>
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


browser.storage.sync.get("options").then(({options}) => {
    ReactDOM.render(
        <OptionsApp options={options} />
      , document.querySelector("#root"));
});
