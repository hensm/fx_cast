"use strict";

export function cloneIntoWithProto (obj, destination) {
	const ret = cloneInto(obj, destination);

	for (const key of Object.getOwnPropertyNames(obj.__proto__)) {
	    exportFunction(obj.__proto__[key].bind(obj), ret, { defineAs: key });
	}

	return ret;
}
