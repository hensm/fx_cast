"use strict";

document.addEventListener("__castMessageResponse", ev => {
	browser.runtime.sendMessage(ev.detail);
})

browser.runtime.onMessage.addListener(message => {
	const event = new CustomEvent("__castMessage", {
		detail: JSON.stringify(message)
	});
	document.dispatchEvent(event);
});
