"use strict";

const { spawnSync } = require("child_process");
const { ROOT, INCLUDE_PATH } = require("./lib/paths");


spawnSync(`tslint --config ${ROOT}/tslint.json \
                  --project ${ROOT}/tsconfig.json \
                  "${INCLUDE_PATH}/**/*.ts{,x}"`
    , {
        shell: true
      , stdio: [ process.stdin, process.stdout, process.stderr ]
    });
