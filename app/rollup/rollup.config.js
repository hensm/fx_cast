import { resolve } from 'path'

import babel from 'rollup-plugin-babel'
import builtins from 'rollup-plugin-node-builtins'
import commonjs from 'rollup-plugin-commonjs'
import json from 'rollup-plugin-json'
import nodeResolve from 'rollup-plugin-node-resolve'

import noMemcpy from './no-memcpy-plugin'

export default options => {
    // TODO: Enabling this option presently doesn't work because castv2 proto
    // files aren't bundled, can be fixed with a couple of plugins
    const external = options.dependencies ? () => false : (id, parentId) => {
        if (!parentId) {
            return true;
        }

        return !!id.match(/^[^./].+$/)
            || resolve(parentId, '..', id).includes('/node_modules/');
    };

    return {
        external
      , input: './src/js/main.js'
      , plugins: [
            noMemcpy()
          , babel({
                exclude: [
                    'node_modules/**'
                ]
              , runtimeHelpers: true
            })
          , json()
          , builtins()
          , nodeResolve({
                module: true
              , jsnext: true
              , main: true
              , browser: false
            })
          , commonjs({
                // Protobuf detects itself running in Node by attempting to
				// require fs, so we better allow it...
                ignore: ['fs']
            })
        ]
      , output: [
            {
                file: resolve(__dirname, '../../dist/app/app.js')
              , format: 'cjs'
              , sourcemap: options.sourcemap || false
            }
        ]
    };
}
