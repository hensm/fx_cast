import messaging, { Message } from "../messaging";
import pageMessenging from "./pageMessenging";

// Message port to cast manager in background script
const managerPort = messaging.connect({ name: "cast" });

const forwardToPage = (message: Message) => {
    pageMessenging.extension.sendMessage(message);
};
const forwardToMain = (message: Message) => {
    managerPort.postMessage(message);
};

managerPort.onMessage.addListener(forwardToPage);
pageMessenging.extension.addListener(forwardToMain);

managerPort.onDisconnect.addListener(() => {
    pageMessenging.extension.close();
});
