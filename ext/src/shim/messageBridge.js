"use strict";

export function onMessage (listener) {
	document.addEventListener("__castMessage", ev => {
		listener(JSON.parse(ev.detail));
	});
}

export function sendMessage (message) {
	const event = new CustomEvent("__castMessageResponse", {
		detail: message
	});

	document.dispatchEvent(event);
}
