var fs = require('fs')
var path = require('path')
var ipd = require('../index')

var tape = require('tape')


var wasm, memory, start

tape('init', function (t) {
  var src = new Uint8Array(fs.readFileSync(path.join(__dirname, '..', 'ipd.wasm')))
  WebAssembly.instantiate(src, {

  }).then(function (module) {
    console.log(module.instance.exports)

    memory = Buffer.from(module.instance.exports.memory.buffer)
    start = module.instance.exports.__heap_base.value
    wasm = module.instance.exports
    t.end()
  })
})
  
var O = ipd.ObjectCodec([
  ipd.DirectField('foo', 0, ipd.codex.u8),
  ipd.DirectField('bar', 1, ipd.codex.u32),
  ipd.PointedField('name', 5, ipd.codex.u8, ipd.codex.string_u8)
])

var expected = {foo: 1, bar: 1234, name: 'Hello, World!'} 

tape('read raw data', function (t) {

  O.encode(expected, memory, start)
  console.log(memory.slice(start, start+20))


  t.equal(wasm.decode__u8(start), expected.foo)
  t.equal(wasm.decode__u32(start+1), expected.bar)
  var length = wasm.decode_string_length__u8(wasm.decode_relp__u8(start+5)) 

  t.equal(length, expected.name.length)
  var str = wasm.decode_string__u8(wasm.decode_relp__u8(start+5))
  t.equal(memory.slice(str, str+length).toString(), expected.name)
//  module.instance.exports

  t.end()
})

function decode_string(ptr) {
  var length = wasm.decode_string_length__u8(ptr) 
  var str = wasm.decode_string__u8(ptr)
  return memory.toString('utf8', str, str+length)
}

tape('read via generated apis', function (t) {
  t.equal(wasm.decode__basic_foo(start), expected.foo)
  t.equal(wasm.decode__basic_bar(start), expected.bar)
  t.equal(decode_string(wasm.decode__basic_name(start)), expected.name)
  t.end()
})
//*/