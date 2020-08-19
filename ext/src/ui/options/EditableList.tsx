/* tslint:disable:max-line-length */
"use strict";

import React, { Component } from "react";

const _ = browser.i18n.getMessage;


interface EditableListProps {
    data: string[];
    itemPattern: RegExp;
    onChange (data: string[]): void;
    itemPatternError (err?: string): string;
}

interface EditableListState {
    addingNewItem: boolean;
    rawView: boolean;
    rawViewValue: string;
}

export default class EditableList extends Component<
        EditableListProps, EditableListState> {

    private rawViewTextArea: (HTMLTextAreaElement | null) = null;

    constructor (props: EditableListProps) {
        super(props);

        this.state = {
            addingNewItem: false
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

    public render () {
        return (
            <div className="editable-list">
                { this.state.rawView
                    ? (
                        <textarea className="editable-list__raw-view"
                                  rows={ Math.min(this.props.data.length, 10) }
                                  value={ this.state.rawViewValue }
                                  onChange={ this.handleRawViewTextAreaChange }
                                  ref={ el => { this.rawViewTextArea = el; }}>
                        </textarea>
                    ) : (
                        <ul className="editable-list__items">
                            { this.props.data.map((item, i) =>
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
                        </ul>
                    )}
                <hr />
                <div className="editable-list__view-actions">
                    { !this.state.rawView &&
                        <button className="editable-list__add-button ghost"
                                title={ _("optionsUserAgentWhitelistAddItem") }
                                onClick={ this.handleAddItem }
                                type="button">
                            <img src="assets/photon_new.svg" alt="icon, add" />
                        </button> }

                    { this.state.rawView &&
                        <button className="editable-list__save-raw-button"
                                onClick={ this.handleSaveRaw }
                                type="button">
                            { _("optionsUserAgentWhitelistSaveRaw") }
                        </button> }

                    <button className="editable-list__view-button"
                            onClick={ this.handleSwitchView }
                            type="button">
                        { this.state.rawView
                            ? _("optionsUserAgentWhitelistBasicView")
                            : _("optionsUserAgentWhitelistRawView") }
                    </button>
                </div>
            </div>
        );
    }

    private handleItemRemove (item: string) {
        const newItems = new Set(this.props.data);
        newItems.delete(item);

        this.props.onChange([...newItems]);
    }

    private handleItemEdit (item: string, newValue: string) {
        this.props.onChange(this.props.data.map(
                currentItem => currentItem === item
                    ? newValue
                    : currentItem));
    }

    private handleSwitchView () {
        this.setState(currentState => {
            if (currentState.rawView) {
                return {
                    rawView: false
                  , rawViewValue: ""
                };
            }

            return {
                rawView: true
              , rawViewValue: this.props.data.join("\n")
            };
        });
    }

    private handleSaveRaw () {
        this.setState(currentState => {
            const newItems = currentState.rawViewValue.split("\n")
                .filter(item => item !== "");

            if ("itemPattern" in this.props) {
                for (const item of newItems) {
                    if (!this.props.itemPattern.test(item)) {
                        this.rawViewTextArea?.setCustomValidity(
                                this.props.itemPatternError(item));
                        return;
                    }
                }

                this.rawViewTextArea?.setCustomValidity("");
            }

            this.props.onChange(newItems);
        });
    }

    private handleRawViewTextAreaChange (ev: React.ChangeEvent<HTMLTextAreaElement>) {
        if (!this.rawViewTextArea) {
            return;
        }

        if (this.rawViewTextArea.scrollHeight > this.rawViewTextArea.clientHeight) {
            this.rawViewTextArea.style.height = `${this.rawViewTextArea.scrollHeight}px`;
        }

        this.setState({
            rawViewValue: ev.target.value
        });
    }

    private handleAddItem () {
        this.setState({
            addingNewItem: true
        });
    }

    private handleNewItemRemove () {
        this.setState({
            addingNewItem: false
        });
    }

    private handleNewItemEdit (_item: string, newItem: string) {
        this.setState({
            addingNewItem: false
        }, () => {
            this.props.onChange([ ...this.props.data, newItem ]);
        });
    }
}


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

class EditableListItem extends Component<
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
        if (!this.state.editing) {
            this.setState({
                editing: true
              , editValue: this.props.text
            }, () => {
                this.input?.focus();
                this.input?.select();
            });
        }
    }

    private handleEditEnd (ev: React.FocusEvent<HTMLInputElement>) {
        this.stopEditing(ev.target);
    }

    private handleInputChange (ev: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            editValue: ev.target.value
        });

        // If invalid, set custom error from parent
        ev.target.setCustomValidity(!this.props.itemPattern.test(ev.target.value)
            ? this.props.itemPatternError()
            : "");
    }

    private handleInputKeyPress (ev: React.KeyboardEvent<HTMLInputElement>) {
        if (ev.key === "Enter") {
            this.stopEditing(ev.target as HTMLInputElement);
        }
    }
}
