"use strict";

const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");


const sourceFileExtensions = [
    ".js", ".jsx"
  , ".ts", ".tsx"
];

module.exports = (env) => ({
    entry: {
        "main": `${env.includePath}/main.ts`

        // UI
      , "ui/popup/bundle": `${env.includePath}/ui/popup/index.tsx`
      , "ui/options/bundle": `${env.includePath}/ui/options/index.tsx`
      , "ui/updater/bundle": `${env.includePath}/ui/updater/index.tsx`

        // Sender apps
      , "senders/mediaCast": `${env.includePath}/senders/mediaCast.js`
      , "senders/mirroringCast": `${env.includePath}/senders/mirroringCast.js`

        // Shim entries
      , "shim/bundle": `${env.includePath}/shim/index.ts`
      , "shim/content": `${env.includePath}/shim/content.ts`
      , "shim/contentSetup": `${env.includePath}/shim/contentSetup.ts`
    }
  , output: {
        filename: "[name].js"
      , path: env.outputPath
    }
  , plugins: [
        new webpack.DefinePlugin({
            "EXTENSION_NAME": JSON.stringify(env.extensionName)
          , "EXTENSION_ID": JSON.stringify(env.extensionId)
          , "EXTENSION_VERSION": JSON.stringify(env.extensionVersion)
          , "MIRRORING_APP_ID": JSON.stringify(env.mirroringAppId)
          , "APPLICATION_NAME": JSON.stringify(env.applicationName)
          , "APPLICATION_VERSION": JSON.stringify(env.applicationVersion)
        })

        // Copy static assets
      , new CopyWebpackPlugin([
            {
                from: env.includePath
              , to: env.outputPath
              , ignore: sourceFileExtensions.map(ext => `*${ext}`)
              , transform (content, path) {
                    // Access to variables in static files
                    if (path.endsWith(".json")) {
                        return Buffer.from(content.toString()
                            .replace("EXTENSION_NAME", env.extensionName)
                            .replace("EXTENSION_ID", env.extensionId)
                            .replace("EXTENSION_VERSION", env.extensionVersion)
                            .replace("MIRRORING_APP_ID", env.mirroringAppId)
                            .replace("APPLICATION_NAME", env.applicationName)
                            .replace("APPLICATION_VERSION", env.applicationVersion)
                            .replace("CONTENT_SECURITY_POLICY", env.contentSecurityPolicy)
                            .replace("AUTHOR", env.author)
                            .replace("AUTHOR_HOMEPAGE", env.authorHomepage));
                    }

                    return content;
                }
            }
          , {
                // Copy vendor dir
                from: path.join(env.includePath, "vendor")
              , to: path.join(env.outputPath, "vendor")
            }
        ])
    ]
  , module: {
        rules: [
            {
                test: /\.(js|ts)x?$/
              , resolve: {
                    extensions: sourceFileExtensions
                }
              , include: env.includePath
              , use: {
                    loader: "ts-loader"
                }
            }
        ]
    }
  , resolve: {
        alias: {
            "react": "preact-compat"
          , "react-dom": "preact-compat"
        }
    }
});
