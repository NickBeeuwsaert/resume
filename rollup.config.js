import buble from 'rollup-plugin-buble';
import nodeResolve from 'rollup-plugin-node-resolve';
import json from 'rollup-plugin-json';

export default {
    entry: 'src/index.js',
    dest: 'dist/index.js',
    format: 'umd',
    moduleContext: {
        [require.resolve('promise-polyfill')]: 'window',
        [require.resolve('whatwg-fetch')]: 'window'
    },
    plugins: [
        json({
            exclude: 'node_modules/**'
        }),
        buble({
            jsx: 'h'
        }),
        nodeResolve({
            jsnext: true
        })
    ]
};
