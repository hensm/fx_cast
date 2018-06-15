"use strict";

const NAMESPACE = "urn:x-cast:fx_cast";

const castReceiverManager = cast.receiver.CastReceiverManager.getInstance();

const mediaElement = document.querySelector("#media");
const mediaManager = new cast.receiver.MediaManager(mediaElement);
mediaElement.width = window.innerWidth;


let senderId;

const messageBus = castReceiverManager.getCastMessageBus(
        NAMESPACE
      , cast.receiver.CastMessageBus.MessageType.JSON);


const pc = new RTCPeerConnection();

pc.addEventListener("icecandidate", ev => {
    messageBus.send(senderId, {
        subject: "iceCandidate"
      , data: ev.candidate
    });
});
pc.addEventListener("addstream", ev => {
    mediaElement.srcObject = ev.stream;
    mediaElement.webkitRequestFullscreen();
});

messageBus.onMessage = async message => {
    const { subject, data } = message.data;

    senderId = message.senderId;

    switch (subject) {
        case "peerConnectionOffer":
            await pc.setRemoteDescription(data);
            const desc = await pc.createAnswer();
            await pc.setLocalDescription(desc);
            messageBus.send(message.senderId, {
                subject: "peerConnectionAnswer"
              , data: desc
            });
            break;

        case "iceCandidate":
            console.log(data);
            await pc.addIceCandidate(data);
            break;

        case "close":
            window.close();
            break;
    }
};

// TODO: Fix APi shim to make this work
castReceiverManager.onSenderDisconnected = ev => {
    if (castReceiverManager.getSenders().length <= 0) {
        window.close();
    }
};

castReceiverManager.start();
