function sendMessage (message) {
    const msgElement = document.createElement("div");
    msgElement.setAttribute("id", "__msg");
    msgElement.textContent = JSON.stringify(message);
    document.body.appendChild(msgElement);
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
        sendMessage({
            subject: method
          , data: result
        });
    }
}

jasmine.getEnv().addReporter(customReporter);
