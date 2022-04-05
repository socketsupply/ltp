var fs = require('fs')
var path = require('path')
var ltp = require('../index')

var tape = require('tape')


var wasm, memory, start, module

tape('init', function (t) {
  var src = new Uint8Array(fs.readFileSync(path.join(__dirname, '..', 'ltp.wasm')))
  WebAssembly.instantiate(src, {

  }).then(function (_module) {
    module = _module
    memory = Buffer.from(module.instance.exports.memory.buffer)
    start = module.instance.exports.__heap_base.value
    wasm = module.instance.exports
    t.end()
  })
})
  
var O = ltp.ObjectCodec([
  ltp.DirectField('foo', 0, ltp.codex.u8),
  ltp.DirectField('bar', 1, ltp.codex.u32),
  ltp.PointedField('name', 5, ltp.codex.u8, ltp.codex.string_u8),
  ltp.PointedField('list', 6, ltp.codex.u8, ltp.ArrayCodec(ltp.codex.u8, ltp.codex.u8, ltp.codex.string_u8))
])

var expected = {foo: 1, bar: 1234, name: 'Hello, World!', list: ['foo', 'bar', 'baz']} 

var baz
// reads types, u9, u32, string_length__u8, string__u8
// (field positions are hard coded)
tape('read raw data', function (t) {

  var length = O.encode(expected, memory, start)
  baz = start+O.encode.bytes
  ltp.codex.string_u8.encode('baz', memory, baz)
  console.log(memory.slice(start, start+30))


  t.equal(wasm.decode__u8(start), expected.foo)
  t.equal(wasm.decode__u32(start+1), expected.bar)
  var length = wasm.decode__length__string_u8(wasm.decode_relp__u8(start+5)) 

  console.log(O.decode(memory, start))

  t.equal(length, expected.name.length)
  var str = wasm.decode__string_u8(wasm.decode_relp__u8(start+5))
  console.log(str)
  t.equal(memory.slice(str, str+length).toString(), expected.name)
//  module.instance.exports

  t.end()
})

function decode_string(ptr) {
  var length = wasm.decode__length__string_u8(ptr) 
  var str = wasm.decode__string_u8(ptr)
  return memory.toString('utf8', str, str+length)
}

// uses generated methods (with named fields) to read fields
// uses generated methods to read pointers, and generic methods to read values.
// (could use generated methods here that do not suffix the field type)
// decode__basic_name__length ???
tape('read via generated apis', function (t) {
  t.equal(wasm.decode__basic_foo(start), expected.foo)
  t.equal(wasm.decode__basic_bar(start), expected.bar)
  t.equal(decode_string(wasm.decode__basic_name(start)), expected.name)
  var list = wasm.decode__basic_list(start)

  var table = wasm.__indirect_function_table
  console.log('table.length', table.length)
  // tried to pass in a js function to callback but it doesn't seem to work like that.
  //  table.grow(1)
  //  table.set(0, function (a, b) { return a === b })
  t.equal(wasm.decode_array_length__u8(list), expected.list.length)

  for(var i = 0; i < expected.list.length; i++) {
    console.log('list['+i+']='+wasm.decode_array_index__u8(list, i))
    t.equal(decode_string(wasm.decode_array_index__u8(list, i)), expected.list[i])
  }

  console.log([
    wasm.decode_array_index__u8(list, 0),
    wasm.decode_array_index__u8(list, 1),
    wasm.decode_array_index__u8(list, 2)
  ])

  //can look up indexes of matching strings
  for(var i = 0; i < expected.list.length; i++) {
    var last = wasm.decode_array_index__u8(list, i)
    t.equal(wasm.array_index_of__string_u8(list, last), i)
  }

    t.equal(wasm.array_index_of__string_u8(list, baz), 2)

//  t.equal(decode_string(), expected.name, expected name)
  t.end()
})
//*/
var expected2 = {foo: 1, bar: 1234, name: 'Hello, World!'} 

var S = ltp.ObjectCodec([
  ltp.DirectField('foo', 0, ltp.codex.u8),
  ltp.DirectField('bar', 1, ltp.codex.u32),
  ltp.PointedField('name', 5, ltp.codex.u8, ltp.codex.string_u8)
])


tape('encodedLength', function (t) {

  //note, endodedLength on schema S, which doesn't have the list
  //so the list bytes are ignored so the length is shorter.
  t.equal(S.encodedLength(memory, start), 21)
  t.end()
})

tape('encode via C', function (t) {

  wasm.encode__basic_foo(start, 10)
  wasm.encode__basic_bar(start, 1_000)
  t.equal(wasm.decode__basic_foo(start), 10)
  t.equal(wasm.decode__basic_bar(start), 1_000)
  t.deepEqual(O.decode(memory, start), {...expected, foo:10, bar:1_000, })
//  var len = O.encodedLength(memory, start)
  //the schema used doesn't have a length field so encodedLength returns undefined
  //but it's a few bytes shorter than 48
  var len = 48
  console.log(memory.slice(start, start+len))
//  wasm.encoded_length__basic
  //a c style nul delimited string
  var cstring = start+len
  var string_u8 = start+len+8
  memory.write('HELLO\x00', cstring, 'utf8')

  wasm.encode__string_u8(string_u8, cstring, 5)
  t.equal(wasm.decode__length__string_u8(string_u8), 5)

  console.log(memory.slice(string_u8, string_u8+1+5))
  console.log(decode_string(string_u8))

  wasm.encode__basic_name(start, string_u8)

  t.equal(O.decode(memory, start).name, 'HELLO')
  t.end()
})

var expected3 = {foo:10, bar:1_000, name: "HELLO"}

tape('encode via C & compact', function (t) {

  wasm.encode__simpler_foo(start, 10)
  wasm.encode__simpler_bar(start, 1_000)
  t.equal(wasm.decode__simpler_foo(start), 10)
  t.equal(wasm.decode__simpler_bar(start), 1_000)

  t.deepEqual(S.decode(memory, start), expected3)

  // since we updated the message in previous test,
  // it's now somewhat greater than 15.
  t.ok(S.encodedLength(memory, start) > 15)
  console.log(S.decode(memory, start), S.decode.bytes)
//  return t.end()
//  console.log("slice", memory.slice(start, start+S.encodedLength(memory, start)).toString('hex'))
//  var len = O.encodedLength(memory, start)
  //the schema used doesn't have a length field so encodedLength returns undefined
  //but it's a few bytes shorter than 48
  var len = 48
  //  wasm.encoded_length__basic
  //a c style nul delimited string
  var cstring = start+len
  var string_u8 = start+len+8
  memory.write('HELLO\x00', cstring, 'utf8')

  wasm.encode__string_u8(string_u8, cstring, 5)
  t.equal(wasm.decode__length__string_u8(string_u8), 5)

  console.log(memory.slice(string_u8, string_u8+1+5))
  console.log(decode_string(string_u8))

  wasm.encode__basic_name(start, string_u8)

  var _buffer = S.compact(memory, start)
  t.equal(S.encodedLength(_buffer, 0), 12) // 1 + 4 + 1 + 1 + 5
  t.deepEqual(S.decode(_buffer, 0), expected3)
  t.end()
})

tape('single encode call', function (t) {
  var start2 = start+100
  var cstring2
  var string = 'HI THERE\x00'
  start2 += memory.write(string, cstring2=start2, 'utf8')
  console.log('hi there', memory.slice(cstring2, cstring2+10))
  t.equal(wasm.strlen(cstring2), string.length-1, "correct string length")
  console.log(wasm.strlen(cstring2))
  var bytes = wasm.encode__simpler(start2, 100, 1000, cstring2)
  console.log(memory.slice(start2, start2+32))
  console.log(bytes)
  t.deepEqual(S.decode(memory, start2), {foo: 100, bar: 1000, name: 'HI THERE'})
  t.end()
})

// no this isn't that interesting,
// bigger question is how to encode
/*
tape('same as bipf benchmark', function (t) {
  wasm.map__get__string_u8(
    wasm.decode__package_dependencies,
    Varint
  )
  t.end()
})
*/