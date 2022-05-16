// @ts-check
"use strict";

const path = require("path");
const fs = require("fs");

// eslint-disable-next-line no-unused-vars
const esbuild = require("esbuild");

/**
 * Walks file tree from a given root path.
 * @param {string} rootPath
 */
function* walk(rootPath) {
    const pathsToWalk = [rootPath];
    while (pathsToWalk.length > 0) {
        const currentPath = pathsToWalk.pop();
        if (fs.statSync(currentPath).isFile()) {
            yield currentPath;
        } else {
            for (const child of fs.readdirSync(currentPath)) {
                pathsToWalk.push(path.join(currentPath, child));
            }
        }
    }
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
    if (!fs.existsSync(opts.src)) {
        throw new Error("copyFilesPlugin: src path not found!");
    }

    const matchingPaths = [];
    for (const path of walk(opts.src)) {
        if (!opts.excludePattern?.test(path)) {
            matchingPaths.push(path);
        }
    }

    return {
        name: "copy-files",
        setup(build) {
            /** First run for the set of import paths in each build. */
            let isFirstRun = true;
            build.onResolve({ filter: /.*/ }, () => {
                /**
                 * Attach watch files to first resolve result.
                 * Presumably there is a much better way of doing
                 * this?
                 */
                if (isFirstRun) {
                    isFirstRun = false;
                    return {
                        watchFiles: matchingPaths
                    };
                }
            });

            build.onEnd(() => {
                isFirstRun = true;

                // Copy any watched files that changed
                for (const srcPath of matchingPaths) {
                    const destPath = path.resolve(
                        opts.dest,
                        path.relative(opts.src, srcPath)
                    );

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
