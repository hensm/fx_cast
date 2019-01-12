"use strict";

// Create socket connection
const socket = new WebSocket("ws://localhost:8080");

window.messageProxy = {
    sendMessage (message) {
        socket.send(JSON.stringify(message));
    }
}

const reporterMethods = [
    "jasmineDone"
  , "jasmineStarted"
  , "specDone"
  , "specStarted"
  , "suiteDone"
  , "suiteStarted"
];

const customReporter = {};

// Populate reporter methods
for (const method of reporterMethods) {
    customReporter[method] = function (result) {
        messageProxy.sendMessage({
            subject: method
          , data: result
        });
    }
}

socket.addEventListener("open", ev => {
    jasmine.getEnv().addReporter(customReporter);
});
