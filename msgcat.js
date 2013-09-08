#!/usr/bin/env node
var inspect = require('util').inspect;
var decode = require('msgpack-js').decode;
var readFile = require('fs').readFileSync;
console.log(inspect(decode(readFile(process.argv[2])), {colors:true}));
