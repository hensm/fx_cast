"use strict";

import minimist from "minimist";


const argv = minimist(process.argv.slice(2), {
    boolean: [ "daemon" ]
  , default: {
        daemon: false
    }
});


if (argv.daemon) {
    import("./daemon");
} else {
    import("./bridge");
}
