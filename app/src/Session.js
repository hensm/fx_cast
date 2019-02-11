import { Client } from "castv2";

export default class Session {
    messageHandler (message) {
        switch (message.subject) {
            case "bridge:/session/close":
                this.close();
                break;

            case "bridge:/session/impl_addMessageListener":
                this._impl_addMessageListener(message.data.namespace);
                break;

            case "bridge:/session/impl_sendMessage":
                this._impl_sendMessage(
                        message.data.namespace
                      , message.data.message
                      , message.data.messageId)
                break;

            case "bridge:/session/impl_setReceiverMuted":
                this._impl_setReceiverMuted(
                        message.data.muted
                      , message.data.volumeId);
                break;

            case "bridge:/session/impl_setReceiverVolumeLevel":
                this._impl_setReceiverVolumeLevel(
                        message.data.newLevel
                      , message.data.volumeId);
                break;

            case "bridge:/session/impl_stop":
                this._impl_stop(message.data.stopId);
                break;
        }
    }

    constructor (host, port, appId, sessionId, _sendMessage) {
        this._sendMessage = _sendMessage;

        this.sessionId = sessionId;
        this.clientConnection;
        this.clientHeartbeat;
        this.clientReceiver;

        this.channelMap = new Map();

        this.client = new Client();
        this.client.connect({ host, port }, () => {
            let transportHeartbeat;

            this.clientConnection = this.client.createChannel(
                "sender-0"
              , "receiver-0"
              , "urn:x-cast:com.google.cast.tp.connection"
              , "JSON");
            this.clientHeartbeat = this.client.createChannel(
                "sender-0"
              , "receiver-0"
              , "urn:x-cast:com.google.cast.tp.heartbeat"
              , "JSON");
            this.clientReceiver = this.client.createChannel(
                "sender-0"
              , "receiver-0"
              , "urn:x-cast:com.google.cast.receiver"
              , "JSON");

            this.clientConnection.send({ type: "CONNECT" });
            this.clientHeartbeat.send({ type: "PING" });

            this.clientHeartbeatInterval = setInterval(() => {
                if (transportHeartbeat) {
                    transportHeartbeat.send({ type: "PING" });
                }
                this.clientHeartbeat.send({ type: "PING" });
            }, 5000);

            this.clientReceiver.send({
                type: "LAUNCH"
              , appId
              , requestId: 1
            });


            let sessionCreated = false;

            this.clientReceiver.on("message", (data, broadcast) => {
                switch (data.type) {
                    case "RECEIVER_STATUS":

                        this.sendMessage("shim:/session/updateStatus", data.status);

                        if (!data.status.applications) return;

                        const receiverApp = data.status.applications[0];
                        const receiverAppId = receiverApp.appId;

                        this.app = receiverApp;

                        if (receiverAppId !== appId) {
                            // Close session
                            this.sendMessage("shim:/session/stopped");
                            this.client.close();
                            clearInterval(this.clientHeartbeatInterval);
                            return;
                        }

                        if (!sessionCreated) {
                            sessionCreated = true;

                            this.transport = this.app.transportId;
                            this.transportId = this.app.transportId;
                            this.clientId = `client-${Math.floor(Math.random() * 10e5)}`;

                            this.transportConnect = this.client.createChannel(
                                this.clientId
                              , this.transport
                              , "urn:x-cast:com.google.cast.tp.connection"
                              , "JSON");

                            this.transportConnect.send({ type: "CONNECT" });

                            transportHeartbeat = this.client.createChannel(
                                this.clientId
                              , this.transport
                              , "urn:x-cast:com.google.cast.tp.heartbeat"
                              , "JSON");

                            this.sessionId = this.app.sessionId;

                            this.sendMessage("shim:/session/connected", {
                                sessionId: this.app.sessionId
                              , namespaces: this.app.namespaces
                              , displayName: this.app.displayName
                              , statusText: this.app.displayName
                            });
                        }

                        break;
                }
            });

        });
    }

    sendMessage (subject, data = {}) {
        this._sendMessage({
            subject
          , data
          , _id: this._id
        });
    }

    createChannel (namespace) {
        if (!this.channelMap.has(namespace)) {
            this.channelMap.set(namespace
                , this.client.createChannel(
                        this.clientId, this.transport, namespace, "JSON"));
        }
    }

    close () {
        this.clientConnection.send({ type: "CLOSE" });
        if (this.transportConnect) {
            this.transportConnect.send({ type: "CLOSE" });
        }
    }

    _impl_addMessageListener (namespace) {
        this.createChannel(namespace);
        this.channelMap.get(namespace).on("message", data => {
            this.sendMessage("shim:/session/impl_addMessageListener", {
                namespace: namespace
              , data: JSON.stringify(data)
            });
        })
    }

    _impl_sendMessage (namespace, message, messageId) {
        let error = false;

        try {
            this.createChannel(namespace);
            this.channelMap.get(namespace).send(message);
        } catch (err) {
            error = true;
        }

        this.sendMessage("shim:/session/impl_sendMessage", {
            messageId
          , error
        });
    }

    _impl_setReceiverMuted (muted, volumeId) {
        let error = false;

        try {
            this.clientReceiver.send({
                type: "SET_VOLUME"
              , volume: { muted }
              , requestId: 0
            });
        } catch (err) {
            error = true;
        }

        this.sendMessage("shim:/session/impl_setReceiverMuted", {
            volumeId
          , error
        });
    }

    _impl_setReceiverVolumeLevel (newLevel, volumeId) {
        let error = false;

        try {
            this.clientReceiver.send({
                type: "SET_VOLUME"
              , volume: { level: newLevel }
              , requestId: 0
            })
        } catch (err) {
            error = true;
        }

        this.sendMessage("shim:/session/impl_setReceiverVolumeLevel", {
            volumeId
          , error
        });
    }

    _impl_stop (stopId) {
        let error = false;

        try {
            this.clientReceiver.send({
                type: "STOP"
              , sessionId: this.sessionId
              , requestId: 0
            });
        } catch (err) {
            error = true;
        }

        this.client.close();
        clearInterval(this.clientHeartbeatInterval);

        this.sendMessage("shim:/session/impl_stop", {
            stopId
          , error
        });
    }
}
