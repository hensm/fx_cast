/* tslint:disable:max-line-length */
"use strict";

import React, { Component } from "react";
import EditableListItem from "./EditableListItem";

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

    private rawViewTextArea: HTMLTextAreaElement;

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
                                  rows={ this.props.data.length > 10
                                             ? this.props.data.length
                                             : 10 }
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
                        <button className="editable-list__add-button"
                                onClick={ this.handleAddItem }
                                type="button">
                            { _("optionsUserAgentWhitelistAddItem") }
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
                        this.rawViewTextArea.setCustomValidity(
                                this.props.itemPatternError(item));
                        return;
                    }
                }

                this.rawViewTextArea.setCustomValidity("");
            }

            this.props.onChange(newItems);
        });
    }

    private handleRawViewTextAreaChange (ev: React.ChangeEvent<HTMLTextAreaElement>) {
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

    private handleNewItemEdit (item: string, newItem: string) {
        this.setState({
            addingNewItem: false
        }, () => {
            this.props.onChange([ ...this.props.data, newItem ]);
        });
    }
}
