"use strict";

import ApiConfig from "./classes/ApiConfig";
import DialRequest from "./classes/DialRequest";
import Error_ from "./classes/Error";
import Image_ from "./classes/Image";
import Receiver from "./classes/Receiver";
import ReceiverDisplayStatus from "./classes/ReceiverDisplayStatus";
import SenderApplication from "./classes/SenderApplication";
import Session, { SessionWrapper } from "./classes/Session";
import SessionRequest from "./classes/SessionRequest";
import Timeout from "./classes/Timeout";
import Volume from "./classes/Volume";

import { AutoJoinPolicy
       , Capability
       , DefaultActionPolicy
       , DialAppState
       , ErrorCode
       , ReceiverAction
       , ReceiverAvailability
       , ReceiverType
       , SenderPlatform
       , SessionStatus
       , VolumeControlType } from "./enums";


import { requestSession as requestSessionTimeout } from "../timeout";



type ReceiverActionListener = (
        receiver: Receiver
      , receiverAction: typeof ReceiverAction) => void;

type RequestSessionSuccessCallback = (session: Session, selectedMedia: string) => void;

type SuccessCallback = () => void;
type ErrorCallback = (err: Error_) => void;


export default class extends EventTarget {
    private apiConfig: ApiConfig;
    private receiverList: any[] = [];
    private sessionList: Session[] = [];
    private sessionRequestInProgress: boolean = false;

    private receiverListeners = new Set<ReceiverActionListener>();

    private sessionSuccessCallback: RequestSessionSuccessCallback;
    private sessionErrorCallback: ErrorCallback;

    private sessionWrapper: SessionWrapper;


    private interface = {
        // Enums
        AutoJoinPolicy, Capability, DefaultActionPolicy, DialAppState
      , ErrorCode, ReceiverAction, ReceiverAvailability, ReceiverType
      , SenderPlatform, SessionStatus, VolumeControlType

        // Classes
      , ApiConfig, DialRequest, Error: Error_, Image: Image_
      , Receiver, ReceiverDisplayStatus, SenderApplication, Session
      , SessionRequest, Timeout, Volume

      , VERSION: [1, 2]
      , isAvailable: false
      , timeout: new Timeout()


      , addReceiverActionListener: (
                listener: ReceiverActionListener): void => {

            console.info("fx_cast (Debug): cast.addReceiverActionListener");
            this.receiverListeners.add(listener);
        }

      , initialize: (
                apiConfig: ApiConfig
              , successCallback: SuccessCallback
              , errorCallback: ErrorCallback): void => {

            console.info("fx_cast (Debug): cast.initialize");

            // Already initialized
            if (this.apiConfig) {
                errorCallback(new Error_(ErrorCode.RECEIVER_UNAVAILABLE));
                return;
            }

            this.apiConfig = apiConfig;

            this.onInitialize();

            apiConfig.receiverListener(this.receiverList.length
                ? ReceiverAvailability.AVAILABLE
                : ReceiverAvailability.UNAVAILABLE);

            successCallback();
        }

      , logMessage: (message: string): void => {
            console.log("CAST MSG:", message);
        }

      , precache: (data: string): void => {
            console.info("STUB :: cast.precache");
        }

      , removeReceiverActionListener: (
                listener: ReceiverActionListener): void => {

            this.receiverListeners.delete(listener);
        }

      , requestSession: (
                successCallback: RequestSessionSuccessCallback
              , errorCallback: ErrorCallback
              , sessionRequest: SessionRequest = this.apiConfig.sessionRequest): void => {

            console.info("fx_cast (Debug): cast.requestSession");

            // Called before initialization
            if (!this.apiConfig) {
                errorCallback(new Error_(ErrorCode.API_NOT_INITIALIZED));
                return;
            }

            // Already requesting session
            if (this.sessionRequestInProgress) {
                errorCallback(new Error_(ErrorCode.INVALID_PARAMETER
                      , "Session request already in progress."));
                return;
            }

            // No available receivers
            if (!this.receiverList.length) {
                errorCallback(new Error_(ErrorCode.RECEIVER_UNAVAILABLE));
                return;
            }

            this.sessionRequestInProgress = true;

            this.sessionSuccessCallback = successCallback;
            this.sessionErrorCallback = errorCallback;

            // Open destination chooser
            this.onRequestSession();
        }

      , requestSessionById: (sessionId: string): void => {
            console.info("STUB :: cast.requestSessionById");
        }

      , setCustomReceivers: (
                receivers: Receiver[]
              , successCallback: SuccessCallback
              , errorCallback: ErrorCallback): void => {

            console.info("STUB :: cast.setCustomReceivers");
        }

      , setPageContext: (win: Window): void => {
            console.info("STUB :: cast.setPageContext");
        }

      , setReceiverDisplayStatus: (sessionId: string): void => {
            console.info("STUB :: cast.setReceiverDisplayStatus");
        }

      , unescape: (escaped: string): string => {
            return unescape(escaped);
        }
    }


    private onInitialize () {
        const ev = new CustomEvent("initialized");
        this.dispatchEvent(ev);
    }
    private onRequestSession () {
        const ev = new CustomEvent("sessionRequested");
        this.dispatchEvent(ev);
    }
    private onCreateSessionWrapper () {
        const ev = new CustomEvent("sessionWrapperCreated");
        this.dispatchEvent(ev);
    }
    private onCreateSession () {
        const ev = new CustomEvent("sessionCreated");
        this.dispatchEvent(ev);
    }

    private onSessionEvent (ev: CustomEvent) {
        const newEvent = new CustomEvent(`session_${ev.type}`, {
            detail: ev.detail
        });

        this.dispatchEvent(newEvent);
    }


    public getReceiverList () {
        return this.receiverList;
    }

    public getSelectedMedia () {
        return this.apiConfig._selectedMedia;
    }

    public getInterface () {
        return this.interface;
    }

    public getSessionWrapper () {
        return this.sessionWrapper;
    }


    public addReciever (receiver: any) {
        this.receiverList.push(receiver);

        // Notify listeners of new cast destination
        this.apiConfig.receiverListener(ReceiverAvailability.AVAILABLE);
    }

    public removeReceiver (receiverId: any) {
        this.receiverList = this.receiverList.filter(
                receiver => receiver.id !== receiverId);

        if (this.receiverList.length === 0) {
            this.apiConfig.receiverListener(
                    ReceiverAvailability.UNAVAILABLE);
        }
    }

    public createSession (receiver: any, selectedMedia: string) {
        console.log(receiver, selectedMedia);

        const selectedReceiver = new Receiver(
                receiver.id
              , receiver.friendlyName);

        (selectedReceiver as any)._address = receiver.address;
        (selectedReceiver as any)._port = receiver.port;


        const sessionWrapper = new SessionWrapper(
                this.sessionList.length
              , this.apiConfig.sessionRequest.appId
              , selectedReceiver.friendlyName
              , []
              , selectedReceiver);

        this.onCreateSessionWrapper();

        sessionWrapper.addEventListener("connected", ev => {
            this.onCreateSession();

            const session = sessionWrapper.getInterface();

            this.apiConfig.sessionListener(session);
            this.sessionRequestInProgress = false;
            this.sessionSuccessCallback(session, selectedMedia);
        });

        // If existing session active, stop it and start new one
        if (this.sessionList.length > 0) {
            const lastSession = this.sessionList[this.sessionList.length - 1];

            if (lastSession.status !== SessionStatus.STOPPED) {
                lastSession.stop(() => {
                    this.sessionList.push(sessionWrapper.getInterface());
                }, null);
            }
        } else {
            this.sessionList.push(sessionWrapper.getInterface());
        }
    }

    public cancelSessionRequest (): void {
        if (this.sessionRequestInProgress) {
            this.sessionRequestInProgress = false;
            this.sessionErrorCallback(new Error_(ErrorCode.CANCEL));
        }
    }
}
