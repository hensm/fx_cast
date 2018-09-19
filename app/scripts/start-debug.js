require('@babel/register')({
    presets: [
        [
            "@babel/preset-env"
          , {
                targets: {
                    node: "current"
                }
            }
        ]
    ]
  , plugins: [
        "@babel/plugin-transform-runtime"
      , "@babel/plugin-syntax-dynamic-import"
      , "@babel/plugin-syntax-import-meta"
      , "@babel/plugin-proposal-class-properties"
      , "@babel/plugin-proposal-json-strings"
    ]
});

require('../src/js/main');
