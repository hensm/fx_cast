export default class Media {
    messageHandler (message) {
        switch (message.subject) {
            case "bridge:/media/sendMediaMessage": {
                let error = false;
                try {
                    this.channel.send(message.data.message);
                } catch (err) {
                    error = true;
                }

                this.sendMessage("shim:/media/sendMediaMessageResponse", {
                    messageId: message.data.messageId
                  , error
                });

                break;
            };
        }
    }

    constructor (sessionId
               , mediaSessionId
               , _id
               , parentSession,
                _sendMessage) {

        this._id = _id;

        this._sendMessage = _sendMessage;

        this.sessionId = sessionId;
        this.mediaSessionId = mediaSessionId;

        const namespace = "urn:x-cast:com.google.cast.media";

        this.session = parentSession;
        this.session.createChannel(namespace);
        this.channel = this.session.channelMap.get(namespace);

        this.channel.on("message", data => {
            if (data && data.type === "MEDIA_STATUS"
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

                this.sendMessage("shim:/media/update", messageData);

                // Update ID
                if (status.mediaSessionId) {
                    this.mediaSessionId = status.mediaSessionId;
                }
            }
        });
    }

    sendMessage (subject, data = {}) {
        this._sendMessage({
            subject
          , data
          , _id: this._id
        });
    }
}
