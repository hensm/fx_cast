"use strict";

const path         = require("path");
const webpack      = require("webpack");
const webpack_copy = require("copy-webpack-plugin");


const include_path = path.resolve(__dirname, "src");
const output_path  = path.resolve(__dirname, "../dist/unpacked");

module.exports = {
    entry: {
        "main"           : `${include_path}/main.js`
      , "popup/bundle"   : `${include_path}/popup/index.js`
      , "shim/bundle"    : `${include_path}/shim/index.js`
      , "content"        : `${include_path}/content.js`
      , "contentSetup"   : `${include_path}/contentSetup.js`
      , "mediaCast"      : `${include_path}/mediaCast.js`
    }
  , output: {
        filename: "[name].js"
      , path: `${output_path}`
    }
  , plugins: [
      //, new webpack.optimize.CommonsChunkPlugin("lib/init.bundle")
        new webpack.DefinePlugin({
            "process.env.NODE_ENV": `"production"`
        })

        // Ext copy assets
      , new webpack_copy([{
            from: `${include_path}`
          , to: `${output_path}`
          , ignore: [ "*.js" ]
        }])
    ]
  , devtool: "source-map"
  , module: {
        loaders: [
            {
                test: /\.js/
              , include: `${include_path}`
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
