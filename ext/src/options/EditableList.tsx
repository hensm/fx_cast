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
    items: Set<string>;
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

    public render () {
        const items = Array.from(this.state.items.values());

        return (
            <div className="editable-list">
                <div className="editable-list__view-actions">
                    { this.state.rawView &&
                        <button className="editable-list__save-raw-button"
                                onClick={ this.handleSaveRaw }>
                            { _("optionsUserAgentWhitelistSaveRaw") }
                        </button> }
                    <button className="editable-list__view-button"
                            onClick={ this.handleSwitchView }>
                        { this.state.rawView
                            ? _("optionsUserAgentWhitelistBasicView")
                            : _("optionsUserAgentWhitelistRawView") }
                    </button>
                </div>
                <hr />
                { this.state.rawView
                    ? (
                        <textarea className="editable-list__raw-view"
                                  rows={ items.length}
                                  value={ this.state.rawViewValue}
                                  onChange={ this.handleRawViewTextAreaChange }
                                  ref={ el => { this.rawViewTextArea = el; }}>
                        </textarea>
                    ) : (
                        <ul className="editable-list__items">
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
                                    { _("optionsUserAgentWhitelistAddItem") }
                                </button>
                            </div>
                        </ul>
                    )}
            </div>
        );
    }

    private handleItemRemove (item: string) {
        this.setState(currentState => {
            const newItems = new Set(currentState.items);
            newItems.delete(item);
            return {
                items: newItems
            };
        }, () => {
            this.props.onChange(Array.from(this.state.items));
        });
    }

    private handleItemEdit (item: string, newValue: string) {
        this.setState(currentState => ({
            items: new Set([...currentState.items]
                    .map(currentItem => currentItem === item
                        ? newValue
                        : currentItem))
        }), () => {
            this.props.onChange(Array.from(this.state.items));
        });
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
              , rawViewValue: Array.from(currentState.items.values()).join("\n")
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

            return {
                items: new Set(newItems)
            };
        }, () => {
            this.props.onChange(Array.from(this.state.items));
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
        this.setState(currentState => ({
            items: new Set([ ...currentState.items, newItem ])
          , addingNewItem: false
        }), () => {
            this.props.onChange(Array.from(this.state.items));
        });
    }
}
