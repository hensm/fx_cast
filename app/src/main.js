"use strict";

const { Client } = require("castv2");
const mdns = require("mdns-js");

const transforms = require("./transforms");


const browser = mdns.createBrowser(mdns.tcp("googlecast"));

// Increase listener limit
require('events').EventEmitter.defaultMaxListeners = 50;

// stdin -> stdout
process.stdin
    .pipe(transforms.decode)
    .pipe(transforms.response(handleMessage))
    .pipe(transforms.encode)
    .pipe(process.stdout);

/**
 * Encode and send a message to the extension.
 */
function sendMessage (message) {
    try {
        transforms.encode.write(message);
    } catch (err) {}
}

/**
 * Handle incoming messages from the extension and forward them to the
 * appropriate handlers.
 */
async function handleMessage (message) {
    if (message.subject.startsWith("bridge:bridgemedia/")) {
        Media.messageHandler(message);
        return;
    }
    if (message.subject.startsWith("bridge:bridgesession/")) {
        Session.messageHandler(message);
        return;
    }

    switch (message.subject) {
        case "bridge:discover":
            browser.discover();
            break;
    }
}


browser.on("update", service => {
    if (!service.txt) return;

    const txt = service.txt
        .reduce((prev, current) => {
            const [ key, value ] = current.split("=");
            prev[key] = value;
            return prev;
        }, {});

    sendMessage({
        subject: "shim:serviceUp"
      , data: {
            address: service.addresses[0]
          , port: service.port
          , id: txt.id
          , friendlyName: txt.fn
        }
    })
});
/*
browser.on("serviceUp", service => {
    transforms.encode.write({
        subject: "shim:serviceUp"
      , data: {
            address: service.addresses[0]
          , port: service.port
          , id: service.txtRecord.id
          , friendlyName: service.txtRecord.fn
        }
    });
});
browser.on("serviceDown", service => {
    transforms.encode.write({
        subject:"shim:serviceDown"
      , data: {
            address: service.addresses[0]
          , port: service.port
          , id: service.txtRecord.id
          , friendlyName: service.txtRecord.fn
        }
    });
})*/


const sessionMap = new Map();

class Session {
    static messageHandler (message) {
        const { _id } = message;

        let session;
        if (sessionMap.has(_id)) {
            session = sessionMap.get(_id);
        }

        switch (message.subject) {
            case "bridge:bridgesession/initialize":
                sessionMap.set(_id, new Session(
                        message.data.address
                      , message.data.port
                      , message.data.appId
                      , message.data.sessionId));
                break;

            case "bridge:bridgesession/close":
                session.close();
                break;

            case "bridge:bridgesession/impl_addMessageListener":
                session._impl_addMessageListener(message.data.namespace);
                break;

            case "bridge:bridgesession/impl_sendMessage":
                session._impl_sendMessage(
                        message.data.namespace
                      , message.data.message
                      , message.data.messageId)
                break;

            case "bridge:bridgesession/impl_setReceiverMuted":
                session._impl_setReceiverMuted(
                        message.data.muted
                      , message.data.volumeId);
                break;

            case "bridge:bridgesession/impl_setReceiverVolumeLevel":
                session._impl_setReceiverVolumeLevel(
                        message.data.newLevel
                      , message.data.volumeId);
                break;

            case "bridge:bridgesession/impl_stop":
                session._impl_stop(message.data.stopId);
                break;
        }
    }

    constructor (host, port, appId, sessionId) {
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

                        this.sendMessage("shim:session/updateStatus", data.status);

                        if (!data.status.applications) return;

                        const receiverApp = data.status.applications[0];
                        const receiverAppId = receiverApp.appId;

                        this.app = receiverApp;

                        if (receiverAppId !== appId) {
                            // Close session
                            this.sendMessage("shim:session/stopped");
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

                            this.sendMessage("shim:session/connected", {
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
        sendMessage({
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
            this.sendMessage("shim:session/impl_addMessageListener", {
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

        this.sendMessage("shim:session/impl_sendMessage", {
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

        this.sendMessage("shim:session/impl_setReceiverMuted", {
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

        this.sendMessage("shim:session/impl_setReceiverVolumeLevel", {
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

        this.sendMessage("shim:session/impl_stop", {
            stopId
          , error
        });
    }
}



const mediaMap = new Map();

class Media {
    static messageHandler (message) {
        const { _id } = message;

        let media;
        if (mediaMap.has(_id)) {
            media = mediaMap.get(_id);
        }

        switch (message.subject) {
            case "bridge:bridgemedia/initialize":
                mediaMap.set(_id
                      , new Media(
                                message.data.sessionId
                              , message.data.mediaSessionId
                              , _id
                              , message.data._internalSessionId));
                break;

            case "bridge:bridgemedia/sendMediaMessage":
                const { messageId } = message.data;
                let error = false;
                try {
                    media.channel.send(message.data.message);
                } catch (err) {
                    error = true;
                }

                media.sendMessage("shim:media/sendMediaMessageResponse", {
                    messageId
                  , error
                });

                break;

            default:
                return;
        }
    }

    constructor (sessionId, mediaSessionId, _id, _internalSessionId) {
        this._id = _id;

        this.sessionId = sessionId;
        this.mediaSessionId = mediaSessionId;

        const namespace = "urn:x-cast:com.google.cast.media";

        this.session = sessionMap.get(_internalSessionId);
        this.session.createChannel(namespace);
        this.channel = this.session.channelMap.get(namespace);

        this.channel.on("message", data => {
            if (data && data.type === 'MEDIA_STATUS'
                    && data.status && data.status.length > 0) {

                const status = data.status[0];

                const messageData = {
                    currentTime: status.currentTime
                  , _lastCurrentTime: Date.now() / 1000
                  , customData: status.customData
                  , _volumeLevel: status.volume.level
                  , _volumeMuted: status.volume.muted
                  , playbackRate: status.playbackRate
                  , playerState: status.playerState
                  , repeatMode: status.repeatMode
                };

                if (status.media) {
                    messageData.media = status.media;
                }
                if (status.mediaSessionId) {
                    messageData.mediaSessionId = status.mediaSessionId;
                }

                this.sendMessage("shim:media/update", messageData);

                // Update ID
                if (status.mediaSessionId) {
                    this.mediaSessionId = status.mediaSessionId;
                }
            }
        });
    }

    sendMessage (subject, data = {}) {
        sendMessage({
            subject
          , data
          , _id: this._id
        });
    }
}
