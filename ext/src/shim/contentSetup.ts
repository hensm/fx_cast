"use strict";

const _window = (window.wrappedJSObject as any);

_window.chrome = cloneInto({}, window);
_window.navigator.presentation = cloneInto({}, window);
