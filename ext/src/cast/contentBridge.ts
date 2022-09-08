import messaging, { Message } from "../messaging";
import pageMessaging from "./pageMessaging";

// Message port to cast manager in background script
const managerPort = messaging.connect({ name: "cast" });

const forwardToPage = (message: Message) => {
    pageMessaging.extension.sendMessage(message);
};
const forwardToMain = (message: Message) => {
    managerPort.postMessage(message);
};

managerPort.onMessage.addListener(forwardToPage);
pageMessaging.extension.addListener(forwardToMain);

managerPort.onDisconnect.addListener(() => {
    pageMessaging.extension.close();
});
