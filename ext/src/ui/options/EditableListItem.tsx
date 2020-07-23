/* tslint:disable:max-line-length */
"use strict";

import React, { Component } from "react";

const _ = browser.i18n.getMessage;


interface EditableListItemProps {
    text: string;
    itemPattern: RegExp;
    editing?: boolean;
    itemPatternError (err?: string): string;
    onRemove (item: string): void;
    onEdit (item: string, newValue: string): void;
}

interface EditableListItemState {
    editing: boolean;
    editValue: string;
}

export default class EditableListItem extends Component<
        EditableListItemProps, EditableListItemState> {

    private input: (HTMLInputElement | null) = null;

    constructor (props: EditableListItemProps) {
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

    public render () {
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
                <button className="editable-list__edit-button ghost"
                        title={ _("optionsUserAgentWhitelistEditItem") }
                        onClick={ this.handleEditBegin }
                        type="button">
                    <img src="assets/photon_edit.svg" alt="icon, edit" />
                </button>
                <button className="editable-list__remove-button ghost"
                        title={ _("optionsUserAgentWhitelistRemoveItem") }
                        onClick={ this.handleRemove }
                        type="button">
                    <img src="assets/photon_delete.svg" alt="icon, remove" />
                </button>
            </li>
        );
    }

    private stopEditing (input: HTMLInputElement) {
        if (this.props.editing
                && !this.props.itemPattern.test(this.state.editValue)) {
            input.setCustomValidity(this.props.itemPatternError());
        }

        if (!input.validity.valid) {
            return;
        }

        this.props.onEdit(this.props.text, this.state.editValue);
        this.setState({
            editing: false
          , editValue: ""
        });
    }

    private handleRemove () {
        this.props.onRemove(this.props.text);
    }

    private handleEditBegin () {
        this.setState({
            editing: true
          , editValue: this.props.text
        }, () => {
            this.input?.focus();
            this.input?.select();
        });
    }

    private handleEditEnd (ev: React.FocusEvent<HTMLInputElement>) {
        this.stopEditing(ev.target);
    }

    private handleInputChange (ev: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            editValue: ev.target.value
        });

        if (!this.props.itemPattern.test(ev.target.value)) {
            ev.target.setCustomValidity(this.props.itemPatternError());
        } else {
            ev.target.setCustomValidity("");
        }
    }

    private handleInputKeyPress (ev: React.KeyboardEvent<HTMLInputElement>) {
        if (ev.key === "Enter") {
            this.stopEditing(ev.target as HTMLInputElement);
        }
    }
}
