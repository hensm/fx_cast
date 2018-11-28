"use strict";

const path              = require("path");
const webpack           = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");


const includePath = path.resolve(__dirname, "src");
const outputPath  = path.resolve(__dirname, "../dist/ext/unpacked");

module.exports = (env) => ({
    entry: {
        "main"           : `${includePath}/main.js`
      , "popup/bundle"   : `${includePath}/popup/index.js`
      , "options/bundle" : `${includePath}/options/index.jsx`
      , "shim/bundle"    : `${includePath}/shim/index.js`
      , "content"        : `${includePath}/content.js`
      , "contentSetup"   : `${includePath}/contentSetup.js`
      , "mediaCast"      : `${includePath}/mediaCast.js`
      , "mirroringCast"  : `${includePath}/mirroringCast.js`
      , "messageRouter"  : `${includePath}/messageRouter.js`
    }
  , output: {
        filename: "[name].js"
      , path: `${outputPath}`
    }
  , plugins: [
        new webpack.DefinePlugin({
            "EXTENSION_NAME"    : JSON.stringify(env.extensionName)
          , "EXTENSION_ID"      : JSON.stringify(env.extensionId)
          , "EXTENSION_VERSION" : JSON.stringify(env.extensionVersion)
          , "MIRRORING_APP_ID"  : JSON.stringify(env.mirroringAppId)
        })

        // Copy static assets
      , new CopyWebpackPlugin([{
            from: includePath
          , to: outputPath
          , ignore: [ "*.js", "*.jsx" ]
          , transform (content, path) {
                // Access to variables in static files
                if (path.endsWith(".json")) {
                    return Buffer.from(content.toString()
                        .replace("EXTENSION_NAME", env.extensionName)
                        .replace("EXTENSION_ID", env.extensionId)
                        .replace("EXTENSION_VERSION", env.extensionVersion)
                        .replace("MIRRORING_APP_ID", env.mirroringAppId));
                }

                return content;
            }
        }])
    ]
  , mode: "development"
  , module: {
        rules: [
            {
                test: /\.jsx?$/
              , resolve: {
                    extensions: [ ".js", ".jsx" ]
                }
              , include: `${includePath}`
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
});
