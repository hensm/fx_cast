"use strict";

function injectScript (url) {
	const script = document.createElement("script");
	script.src = url;
	script.addEventListener("load", ev => {
		script.remove();
	});

	document.documentElement.appendChild(script);
}

injectScript(browser.runtime.getURL("shim/bundle.js"));
//injectScript("https://s.ytimg.com/yts/jsbin/www-tampering-vflyYlECh/www-tampering.js");
//injectScript("https://s.ytimg.com/yts/jsbin/www-prepopulator-vfl8hLntF/www-prepopulator.js");
//injectScript("https://s.ytimg.com/yts/jsbin/webcomponents-lite.min-vfl2VqBkx/webcomponents-lite.min.js");

console.log(script);

