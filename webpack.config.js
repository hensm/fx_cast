"use strict";

const path         = require("path");
const webpack      = require("webpack");
const webpack_copy = require("copy-webpack-plugin");


const include_path = path.resolve(__dirname, "src");
const output_path  = path.resolve(__dirname, "dist");

module.exports = {
    entry: {
        "main"           : `${include_path}/ext/main.js`
      , "popup/bundle"   : `${include_path}/ext/popup/index.js`
      , "shim/bundle"    : `${include_path}/ext/shim/index.js`
      , "content"        : `${include_path}/ext/content.js`
      , "contentSetup"   : `${include_path}/ext/contentSetup.js`
      , "mediaCast"      : `${include_path}/ext/mediaCast.js`
      , "compat/youtube" : `${include_path}/ext/compat/youtube.js`
    }
  , output: {
        filename: "[name].js"
      , path: `${output_path}/ext`
    }
  , plugins: [
        new webpack.optimize.UglifyJsPlugin()
      //, new webpack.optimize.CommonsChunkPlugin("lib/init.bundle")
      , new webpack.DefinePlugin({
            "process.env.NODE_ENV": `"production"`
        })

        // Ext copy assets
      , new webpack_copy([{
            from: `${include_path}/ext`
          , to: `${output_path}/ext`
          , ignore: [ "*.js" ]
        }, {
            from: `${include_path}`
          , to: `${output_path}`
          , ignore: [ "app" ]
        }])
    ]
  , devtool: "source-map"
  , module: {
        loaders: [
            {
                test: /\.js/
              , include: `${include_path}/ext`
              , loader: "babel-loader"
              , options: {
                    presets: [ "react" ]
                  , plugins: [
                        "transform-class-properties"
                      , "transform-do-expressions"
                      , "transform-object-rest-spread"
                    ]
                }
            }
        ]
    }
};
