/* eslint-disable max-len */
"use strict";

import React, { Component } from "react";

import type { WhitelistItemData } from "../../background/whitelist";
import { REMOTE_MATCH_PATTERN_REGEX } from "../../lib/matchPattern";

const _ = browser.i18n.getMessage;

interface WhitelistProps {
    items: WhitelistItemData[];
    onChange: (items: WhitelistItemData[]) => void;
}
interface WhitelistState {
    addingNewItem: boolean;
}

/** Editable list component for site whitelist. */
export default class Whitelist extends Component<
    WhitelistProps,
    WhitelistState
> {
    state: WhitelistState = {
        addingNewItem: false
    };

    render() {
        return (
            <div className="whitelist">
                <ul className="whitelist__items">
                    {this.props.items.map((item, i) => (
                        <WhitelistItem
                            value={item}
                            onEdit={(oldValue, newValue) => {
                                // Replace item
                                this.props.onChange(
                                    this.props.items.map(item =>
                                        item.pattern === oldValue?.pattern
                                            ? newValue
                                            : item
                                    )
                                );
                            }}
                            onRemove={value => {
                                // Remove item
                                this.props.onChange(
                                    this.props.items.filter(
                                        item => item.pattern !== value?.pattern
                                    )
                                );
                            }}
                            key={i}
                        />
                    ))}

                    {this.state.addingNewItem && (
                        <WhitelistItem
                            isEditing={true}
                            onEdit={(__, newValue) => {
                                // Add new item
                                this.setState({ addingNewItem: false }, () => {
                                    this.props.onChange([
                                        ...this.props.items,
                                        newValue
                                    ]);
                                });
                            }}
                            onRemove={() => {
                                // Cancel adding new item
                                this.setState({ addingNewItem: false });
                            }}
                        />
                    )}
                </ul>

                <hr />

                <div className="whitelist__view-actions">
                    <button
                        className="whitelist__add-button ghost"
                        title={_("optionsSiteWhitelistAddItem")}
                        onClick={() => this.setState({ addingNewItem: true })}
                        type="button"
                    >
                        <img src="assets/photon_new.svg" alt="icon, add" />
                    </button>
                </div>
            </div>
        );
    }
}

interface WhitelistItemProps {
    value?: WhitelistItemData;
    /** Initial editing state */
    isEditing?: boolean;
    onEdit: (
        oldValue: WhitelistItemData | undefined,
        newValue: WhitelistItemData
    ) => void;
    onRemove: (value?: WhitelistItemData) => void;
}
interface WhitelistItemState {
    isEditing: boolean;
    editValue?: WhitelistItemData;
}

/** Editable item component for whitelist. */
class WhitelistItem extends Component<WhitelistItemProps, WhitelistItemState> {
    private inputElement: HTMLInputElement | null = null;

    constructor(props: WhitelistItemProps) {
        super(props);
        this.state = { isEditing: props.isEditing ?? false };

        this.beginEditing = this.beginEditing.bind(this);
        this.finishEditing = this.finishEditing.bind(this);
    }

    /** Sets editing state and focuses input field. */
    private beginEditing() {
        if (this.state.isEditing) return;

        this.setState(
            {
                isEditing: true,
                editValue: this.props.value
            },
            () => {
                this.inputElement?.focus();
                this.inputElement?.select();
            }
        );
    }

    /** Checks input validity and sends edit update. */
    private finishEditing() {
        if (!this.state.isEditing || !this.state.editValue) return;

        if (this.inputElement?.validity.valid) {
            this.props.onEdit(this.props.value, this.state.editValue);
            this.setState({
                isEditing: false,
                editValue: undefined
            });
        }
    }

    render() {
        const selectedClassName = this.state.isEditing
            ? "whitelist__item--selected"
            : "";

        return (
            <li className={`whitelist__item ${selectedClassName}`}>
                <div
                    className="whitelist__title"
                    onDoubleClick={this.beginEditing}
                >
                    {this.state.isEditing ? (
                        <input
                            ref={el => (this.inputElement = el)}
                            type="text"
                            className="whitelist__input-pattern"
                            value={this.state.editValue?.pattern}
                            pattern={REMOTE_MATCH_PATTERN_REGEX.source}
                            onChange={ev => {
                                this.setState(prevState => ({
                                    editValue: {
                                        ...prevState.editValue,
                                        pattern: ev.target.value
                                    }
                                }));
                            }}
                            onBlur={this.finishEditing}
                            onKeyPress={ev => {
                                if (ev.key === "Enter") {
                                    this.finishEditing();
                                }
                            }}
                        />
                    ) : (
                        this.props.value?.pattern
                    )}
                </div>

                <label className="whitelist__user-agent">
                    <input
                        type="checkbox"
                        checked={!this.props.value?.isUserAgentDisabled}
                        onChange={ev => {
                            if (!this.props.value) return;
                            this.props.onEdit(this.props.value, {
                                ...this.props.value,
                                isUserAgentDisabled: !ev.target.checked
                            });
                        }}
                    />
                    {_("optionsSiteWhitelistUserAgent")}
                </label>

                <button
                    className="whitelist__edit-button ghost"
                    title={_("optionsSiteWhitelistEditItem")}
                    onClick={this.beginEditing}
                    type="button"
                >
                    <img src="assets/photon_edit.svg" alt="icon, edit" />
                </button>

                <button
                    className="whitelist__remove-button ghost"
                    title={_("optionsSiteWhitelistRemoveItem")}
                    onClick={() => {
                        this.props.onRemove(this.props.value);
                    }}
                    type="button"
                >
                    <img src="assets/photon_delete.svg" alt="icon, remove" />
                </button>
            </li>
        );
    }
}
