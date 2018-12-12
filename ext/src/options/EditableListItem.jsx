import React, { Component } from "react";

const _ = browser.i18n.getMessage;


export default class EditableListItem extends Component {
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
        }, () => {
            this.input.focus();
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
        const selected = this.state.editing
            ? "editable-list__item--selected" : "";

        return (
            <li className={`editable-list__item ${selected}`}>
                <div className="editable-list__title"
                     onDoubleClick={ this.handleEditBegin }>
                    { this.state.editing
                        ? <input className="editable-list__edit-field"
                                 type="text"
                                 ref={ input => this.input = input }
                                 value={ this.state.editValue }
                                 onBlur={ this.handleEditEnd }
                                 onChange={ this.handleInputChange }
                                 onKeyPress={ this.handleInputKeyPress }/>
                        : this.props.text }
                </div>
                <button onClick={ this.handleEditBegin }>
                    { _("optionsUserAgentWhitelistEditItem") }
                </button>
                <button onClick={ this.handleRemove }>
                    { _("optionsUserAgentWhitelistRemoveItem") }
                </button>
            </li>
        );
    }
}
