// @ts-check

import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * @typedef {object} Config
 * @prop {string} author
 * @prop {string} homepageUrl
 * @prop {string} applicationName
 * @prop {string} applicationVersion
 * @prop {string} applicationDirectoryName
 * @prop {string} applicationExecutableName
 * @prop {string} extensionId
 */

/** @type {Config} */
//
let config;

try {
    config = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../../config.json"), {
            encoding: "utf-8"
        })
    );
} catch (err) {
    console.error("Error: Failed to load build config!", err);
    process.exit(1);
}

export default config;
