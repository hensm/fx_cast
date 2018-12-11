import React, { Component } from "react";
import EditableListItem     from "./EditableListItem";

const _ = browser.i18n.getMessage;


export default class EditableList extends Component {
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
            this.props.onChange(Array.from(this.state.items));
        });
    }

    handleItemEdit (item, newValue) {
        this.setState(currentState => ({
            items: new Set([...currentState.items]
                    .map(item_ => item_ === item ? newValue : item_))
        }), () => {
            this.props.onChange(Array.from(this.state.items));
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
            this.props.onChange(Array.from(this.state.items));
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
            this.props.onChange(Array.from(this.state.items));
        });
    }

    render () {
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
                { do {
                    if (this.state.rawView) {
                        <textarea className="editable-list__raw-view"
                                  rows={ items.length}
                                  value={ this.state.rawViewValue}
                                  onChange={ this.handleRawViewTextAreaChange }
                                  ref={ el => { this.rawViewTextArea = el }}>
                        </textarea>
                    } else {
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
                    }
                }}
            </div>
        );
    }
}
