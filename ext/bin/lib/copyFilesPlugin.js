// @ts-check
"use strict";

const path = require("path");
const fs = require("fs");

// eslint-disable-next-line no-unused-vars
const esbuild = require("esbuild");

/**
 * Escape meta characters in a regular expression.
 *
 * @param {string} patternSource
 * @returns {string} Escaped expression source
 */
function escapeRegExp(patternSource) {
    let metaChars = ".+*?()|[]{}^$\\";
    return [...patternSource]
        .map(c => (metaChars.includes(c) ? `\\${c}` : c))
        .join("");
}

/**
 * @typedef {object} CopyFilesPluginOpts
 * @prop {string} src Source path
 * @prop {string} dest Destination path
 * @prop {RegExp=} excludePattern Exclude path pattern
 */
/**
 * Plugin that copies files from specified source to destination after
 * each build.
 *
 * @type {(opts: CopyFilesPluginOpts) => esbuild.Plugin}
 */
exports.copyFilesPlugin = opts => {
    // Get matching file paths
    const matchingFiles = (function getMatchingPaths(relPath = "") {
        const fullPath = path.join(opts.src, relPath);

        // Must exist
        if (!fs.existsSync(fullPath)) return;
        // Must not match exclude pattern
        if (opts.excludePattern?.test(fullPath)) return;

        if (fs.statSync(fullPath).isFile()) {
            return [relPath];
        }

        /** @type string[] */
        let files = [];
        for (const entry of fs.readdirSync(fullPath)) {
            const matchingFiles = getMatchingPaths(path.join(relPath, entry));
            if (matchingFiles) {
                files = files.concat(matchingFiles);
            }
        }
        return files;
    })();

    return {
        name: "copy-files",
        setup(build) {
            /** First run for the set of import paths in each build. */
            let isFirstRun = true;

            build.onResolve(
                {
                    filter: new RegExp(`^${escapeRegExp(opts.src + path.sep)}`)
                },
                () => {
                    /**
                     * Attach watch files to first resolve result.
                     * Presumably there is a much better way of doing
                     * this?
                     */
                    if (isFirstRun) {
                        isFirstRun = false;
                        return {
                            watchFiles: matchingFiles.map(file =>
                                path.join(opts.src, file)
                            )
                        };
                    }
                }
            );

            build.onEnd(() => {
                isFirstRun = true;

                // Copy any watched files that changed
                for (const file of matchingFiles) {
                    const srcPath = path.join(opts.src, file);
                    const destPath = path.join(opts.dest, file);

                    // Ignore if source file is missing
                    if (!fs.existsSync(srcPath)) {
                        if (fs.existsSync(destPath)) {
                            fs.rmSync(destPath);
                        }
                        continue;
                    }

                    // Ensure containing destination directory exists
                    const dirName = path.dirname(destPath);
                    if (!fs.existsSync(dirName)) {
                        fs.mkdirSync(dirName, { recursive: true });
                    }

                    // Check if files match
                    if (fs.existsSync(destPath)) {
                        const srcContent = fs.readFileSync(srcPath);
                        const destContent = fs.readFileSync(destPath);

                        if (srcContent.equals(destContent)) {
                            continue;
                        }
                    }

                    fs.copyFileSync(srcPath, destPath);
                }
            });
        }
    };
};
