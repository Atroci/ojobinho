Vendored from [hyparquet](https://github.com/hyparam/hyparquet) 1.33.1 (MIT, Hyperparam).
`src/node.js` is not included: it reads local files. The ATS adapter passes an
HTTPS byte-range buffer instead. Snappy decompression inside `src/snappy.js`
is the MIT snippet by Zhipeng Jia. ZSTD uses `node:zlib`.
