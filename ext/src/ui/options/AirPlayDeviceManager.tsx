"use strict";

import React, { Component } from "react";

import { AirPlayAuthCredentials } from "../../lib/auth"
import * as base64 from "../../lib/base64";
import * as devices from "./devices";


const _ = browser.i18n.getMessage;


interface AirPlayDeviceProps {
    data: devices.Device;

    onRemove: (device: devices.Device) => void;
    onRegenCredentials: (device: devices.Device) => void;
    onPairCredentials: (device: devices.Device) => void;
}

const AirPlayDevice = (props: AirPlayDeviceProps) => {
    const clientSk = base64.encode(props.data.credentials.clientSk);
    const clientPk = base64.encode(props.data.credentials.clientPk);

    const pairedStatusClassName = !props.data.isPaired
        ? "device__paired-status"
        : "device__paired-status device__paired-status--paired";


    function copyCredentials () {
        navigator.clipboard.writeText(
                `  Client ID: ${props.data.credentials.clientId}\n`
              + `Private Key: ${clientSk}\n`
              + ` Public Key: ${clientPk}`);
    }

    return (
        <div className="device">
            <div className="device__actions">
                <button className="device__action"
                        onClick={ () => {
                            props.onRemove(props.data);
                        }}>
                    { _("optionsAirPlayDeviceRemove") }
                </button>

                { props.data.isPaired ||
                    <button className="device__action"
                            onClick={ () => {
                                props.onPairCredentials(props.data);
                            }}>
                        { _("optionsAirPlayDevicePair") }
                    </button> }
            </div>
            <div className="device__meta">
                <div className="device__name">
                    { props.data.name }
                    <span className={pairedStatusClassName}>
                        { props.data.isPaired
                            ? _("optionsAirPlayDevicePairedStatusPaired")
                            : _("optionsAirPlayDevicePairedStatusUnpaired") }
                    </span>
                </div>
                <div className="device__address">
                    { props.data.address }
                </div>
            </div>
            <details className="device__credentials">
                <summary>{ _("optionsAirPlayDeviceCredentials") }</summary>

                <table>
                    <tr>
                        <th>{ _("optionsAirPlayDeviceCredentialsClientId") }</th>
                        <td>{ props.data.credentials.clientId }</td>
                    </tr>
                    <tr>
                        <th>{ _("optionsAirPlayDeviceCredentialsPrivateKey") }</th>
                        <td>{ clientSk }</td>
                    </tr>
                    <tr>
                        <th>{ _("optionsAirPlayDeviceCredentialsPublicKey") }</th>
                        <td>{ clientPk }</td>
                    </tr>
                </table>

                <div className="device__credentials-actions">
                    <button className="small"
                            onClick={ () => {
                                props.onRegenCredentials(props.data);
                            }}>
                        { _("optionsAirPlayDeviceCredentialsRegenerate") }
                    </button>
                    <button className="small"
                            onClick={ copyCredentials }>
                        { _("optionsAirPlayDeviceCredentialsCopyToClipboard") }
                    </button>
                </div>
            </details>
        </div>
    );
};


interface AirPlayDeviceManagerProps {}
interface AirPlayDeviceManagerState {
    hasLoaded: boolean;
    isFormValid: boolean;
    devices: devices.Device[];

    newDeviceName: string;
    newDeviceAddress: string;
    newDeviceAddressSuggestion: string;
}

export default class AirPlayDeviceManager extends Component<
        AirPlayDeviceManagerProps, AirPlayDeviceManagerState> {

    constructor (props: AirPlayDeviceManagerProps) {
        super(props);

        this.onFormSubmit = this.onFormSubmit.bind(this);
        this.onFormInput = this.onFormInput.bind(this);

        this.onDeviceAdd = this.onDeviceAdd.bind(this);
        this.onDeviceRemove = this.onDeviceRemove.bind(this);
        this.onDeviceRegenCredentials = this.onDeviceRegenCredentials.bind(this);
        this.onDevicePairCredentials = this.onDevicePairCredentials.bind(this);

        this.onNewDeviceNameChange = this.onNewDeviceNameChange.bind(this);
        this.onNewDeviceAddressChange = this.onNewDeviceAddressChange.bind(this);


        this.state = {
            hasLoaded: false
          , isFormValid: false
          , devices: []

          , newDeviceName: ""
          , newDeviceAddress: ""
          , newDeviceAddressSuggestion: ""
        };
    }

    public render () {
        if (!this.state.hasLoaded) {
            return;
        }

        return (
            <div className="device-manager">
                <ul className="device-manager__devices">
                    { this.state.devices.length
                        ? this.state.devices.map(device => (
                                  <AirPlayDevice data={ device }
                                          onRemove={ this.onDeviceRemove }
                                          onRegenCredentials={this.onDeviceRegenCredentials }
                                          onPairCredentials={ this.onDevicePairCredentials } /> ))
                        : <div className="device-manager__no-devices">
                              { _("optionsAirPlayDeviceManagerNoDevices") }
                          </div> }
                </ul>

                <form className="device-manager-new"
                      onSubmit={this.onFormSubmit}
                      onInput={this.onFormInput}>

                    <label className="device-manager-new__label">
                        <div className="device-manager-new__input-label">
                            { _("optionsAirPlayDeviceManagerNewName") }
                        </div>                    
                        <input className="device-manager-new__input-name"
                               type="text"
                               //required
                               name="newDeviceName"
                               placeholder="Living Room"
                               value={ this.state.newDeviceName }
                               onChange={ this.onNewDeviceNameChange } />
                    </label>

                    <label className="device-manager-new__label">
                        <div className="device-manager-new__input-label">
                            { _("optionsAirPlayDeviceManagerNewAddress") }
                        </div>
                        <input className="device-manager-new__input-address"
                               type="text"
                               pattern="^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$"
                               name="newDeviceAddress"
                               placeholder={
                                       (this.state.newDeviceName
                                            && this.state.newDeviceAddressSuggestion)
                                    || "living-room.local" }
                               value={ this.state.newDeviceAddress }
                               onChange={ this.onNewDeviceAddressChange } />
                    </label>

                    <button className="device-manager-new__submit"
                           type="submit"
                           disabled={ !this.state.isFormValid }>
                        { _("optionsAirPlayDeviceManagerNewSubmit") }
                    </button>
                </form>
            </div>
        );
    }

    public async componentDidMount () {
        this.setState({
            hasLoaded: true
          , devices: await devices.getAll()
        });
    }


    private onFormSubmit (ev: React.FormEvent<HTMLFormElement>) {
        ev.preventDefault();

        if (ev.currentTarget.reportValidity()) {
            this.onDeviceAdd();
        }
    }

    private onFormInput (ev: React.ChangeEvent<HTMLFormElement>) {
        this.setState({
            isFormValid: ev.currentTarget.reportValidity()
        });
    }


    private async onDeviceAdd () {
        const device: devices.Device = {
            name: this.state.newDeviceName
          , address: this.state.newDeviceAddress
          , credentials: new AirPlayAuthCredentials()
          , isPaired: false
        };

        // Use generated suggested address if user left it blank
        if (!this.state.newDeviceAddress) {
            device.address = this.state.newDeviceAddressSuggestion;
        }

        await devices.add(device);

        this.setState({
            devices: await devices.getAll()
        });
    }

    private onDeviceRemove (device: devices.Device) {
        this.setState(state => ({
            devices: state.devices.filter(d => d.name !== device.name)
        }));

        devices.remove(device);
    }

    private onDeviceRegenCredentials (device: devices.Device) {
        this.setState(state => {
            devices: state.devices.map(d => {
                /**
                 * Generate and set new credentials with an empty
                 * AirPlayAuthCredentials call. Then, since the new credentials
                 * aren't paired, set isPaired to false.
                 */
                if (d.name === device.name) {
                    d.credentials = new AirPlayAuthCredentials();
                    d.isPaired = false;
                }

                return d;
            });
        });
    }

    private onDevicePairCredentials () {}


    /**
     * Each time the new device name field is changed, provided the
     * user has not already set an address in the address field,
     * make a best-guess at what the actual address is and set the
     * placeholder attribute of the address field to display it as
     * indication.
     * 
     * If, once the new device form is submitted, the address field
     * was left blank, the suggested address is used instead.
     */
    private onNewDeviceNameChange (ev: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            newDeviceName: ev.target.value
        });

        if (!this.state.newDeviceAddress) {
            /**
             * Use the same-ish formatting rules as macOS for service
             * names:
             *  - Consecutive whitespace is replaced by a single space. No
             *     need for tabs or newlines.
             *  - All remaining spaces are replaced by hyphens.
             *  - Any characters that aren't alpha-numerics or hyphens are
             *     removed.
             */
            const formattedName = ev.target.value
                .replace(/\s{2,}/g, " ")
                .replace(/ /g, "-")
                .replace(/[^a-zA-Z0-9-]/g, "");

            // Set new suggestion
            this.setState({
                newDeviceAddressSuggestion: `${formattedName}.local`
            });
        }
    }

    private onNewDeviceAddressChange (ev: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            newDeviceAddress: ev.target.value
        });
    }
}
