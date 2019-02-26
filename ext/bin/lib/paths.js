"use strict";

const path = require("path");

exports.ROOT = path.resolve(__dirname, "../../");
exports.INCLUDE_PATH = path.resolve(exports.ROOT, "src");
exports.DIST_PATH = path.join(exports.ROOT, "../dist/ext");
exports.UNPACKED_PATH = path.join(exports.DIST_PATH, "unpacked");
