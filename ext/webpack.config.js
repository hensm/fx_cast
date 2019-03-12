"use strict";

const path              = require("path");
const webpack           = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = (env) => ({
    entry: {
        "main"           : `${env.includePath}/main.ts`
      , "popup/bundle"   : `${env.includePath}/popup/index.tsx`
      , "options/bundle" : `${env.includePath}/options/index.tsx`
      , "updater/bundle" : `${env.includePath}/updater/index.tsx`
      , "mediaCast"      : `${env.includePath}/mediaCast.js`
      , "mirroringCast"  : `${env.includePath}/mirroringCast.js`
      , "compat/youtube" : `${env.includePath}/compat/youtube.js`

        // Shim entries
      , "shim/bundle"       : `${env.includePath}/shim/index.ts`
      , "shim/content"      : `${env.includePath}/shim/content.ts`
      , "shim/contentSetup" : `${env.includePath}/shim/contentSetup.ts`
    }
  , output: {
        filename: "[name].js"
      , path: env.outputPath
    }
  , plugins: [
        new webpack.DefinePlugin({
            "EXTENSION_NAME"      : JSON.stringify(env.extensionName)
          , "EXTENSION_ID"        : JSON.stringify(env.extensionId)
          , "EXTENSION_VERSION"   : JSON.stringify(env.extensionVersion)
          , "MIRRORING_APP_ID"    : JSON.stringify(env.mirroringAppId)
          , "APPLICATION_NAME"    : JSON.stringify(env.applicationName)
          , "APPLICATION_VERSION" : JSON.stringify(env.applicationVersion)
        })

        // Copy static assets
      , new CopyWebpackPlugin([
            {
                from: env.includePath
              , to: env.outputPath
              , ignore: [ "*.js", "*.jsx"
                        , "*.ts", "*.tsx" ]
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
                            .replace("CONTENT_SECURITY_POLICY", env.contentSecurityPolicy));
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
                    extensions: [ ".js", ".jsx"
                                , ".ts", ".tsx" ]
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
