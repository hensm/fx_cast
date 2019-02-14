"use strict";

const path              = require("path");
const webpack           = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = (env) => ({
    entry: {
        "main"           : `${env.includePath}/main.js`
      , "popup/bundle"   : `${env.includePath}/popup/index.jsx`
      , "options/bundle" : `${env.includePath}/options/index.jsx`
      , "shim/bundle"    : `${env.includePath}/shim/index.js`
      , "updater/bundle" : `${env.includePath}/updater/index.jsx`
      , "content"        : `${env.includePath}/content.js`
      , "contentSetup"   : `${env.includePath}/contentSetup.js`
      , "mediaCast"      : `${env.includePath}/mediaCast.js`
      , "mirroringCast"  : `${env.includePath}/mirroringCast.js`
      , "compat/youtube" : `${env.includePath}/compat/youtube.js`
    }
  , output: {
        filename: "[name].js"
      , path: `${env.outputPath}`
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
              , ignore: [ "*.js", "*.jsx" ]
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
                test: /\.jsx?$/
              , resolve: {
                    extensions: [ ".js", ".jsx" ]
                }
              , include: `${env.includePath}`
              , use: {
                    loader: "babel-loader"
                  , options: {
                        presets: [
                            "@babel/preset-react"
                        ]
                      , plugins: [
                            "@babel/proposal-class-properties"
                          , "@babel/proposal-do-expressions"
                          , "@babel/proposal-object-rest-spread"
                        ]
                    }
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
