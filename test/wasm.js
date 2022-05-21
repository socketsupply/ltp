var fs = require('fs')
var path = require('path')
var ltp = require('../index')
var crypto = require('crypto')
var tape = require('tape')

function memcpy (dst, from, len) {
  memory.copy(memory, dst, from, from+len)
}

function strlen (cstr) {
  for(var i = 0; 0 != memory[cstr+i] && i < memory.length; i++) ;
  return i
}
  
var O = ltp.ObjectCodec([
  ltp.DirectField('foo', 0, ltp.codex.u8),
  ltp.DirectField('bar', 1, ltp.codex.u32),
  ltp.PointedField('name', 5, ltp.codex.u8, ltp.codex.string_u8),
  ltp.PointedField('list', 6, ltp.codex.u8, ltp.ArrayCodec(ltp.codex.u8, ltp.codex.u8, ltp.codex.string_u8))
])

var S = ltp.ObjectCodec([
  ltp.DirectField('foo', 0, ltp.codex.u8),
  ltp.DirectField('bar', 1, ltp.codex.u32),
  ltp.PointedField('name', 5, ltp.codex.u8, ltp.codex.string_u8)
])

var F = ltp.ObjectCodec([
  ltp.FixedPositionVariableSizeField('text', 96, ltp.codex.string_u16),
  ltp.DirectField('hash', 64, ltp.codex.fixed_32),
  ltp.DirectField('signature', 0, ltp.codex.fixed_64),
])

var BN = ltp.ObjectCodec([
  ltp.PointedField('name', 0, ltp.codex.u32, ltp.codex.string_u32)
])

var wasm, memory, start, module

tape('init', function (t) {
  var src = new Uint8Array(fs.readFileSync(path.join(__dirname, 'build', 'ltp.wasm')))
  WebAssembly.instantiate(src, {

  }).then(function (_module) {
    module = _module
    wasm = module.instance.exports
    memory = Buffer.from(wasm.memory.buffer)
    start = wasm.__heap_base ? wasm.__heap_base.value : 10_000;
    t.end()
  })
})


var expected = {foo: 1, bar: 1234, name: 'Hello, World!', list: ['foo', 'bar', 'baz']} 

var baz
// reads types, u9, u32, string_length__u8, string__u8
// (field positions are hard coded)
tape('read raw data', function (t) {

  var length = O.encode(expected, memory, start)
  baz = start+O.encode.bytes
  ltp.codex.string_u8.encode('baz', memory, strlen(baz), baz)
  console.log(memory.slice(start, start+30))


  t.equal(wasm.ltp_decode__u8(start), expected.foo)
  t.equal(wasm.ltp_decode__u32(start+1), expected.bar)
  var length2 = wasm.ltp_decode__length__string_u8(wasm.ltp_decode_relp__u8(start+5)) 

  console.log(O.decode(memory, start))

  t.equal(length2, expected.name.length)
  var str = wasm.ltp_decode__string_u8(wasm.ltp_decode_relp__u8(start+5))
  t.equal(memory.slice(str, str+length2).toString(), expected.name)

  t.end()
})

function decode_string(ptr) {
  var length = wasm.ltp_decode__length__string_u8(ptr) 
  var str = wasm.ltp_decode__string_u8(ptr)
  return memory.toString('utf8', str, str+length)
}

// uses generated methods (with named fields) to read fields
// uses generated methods to read pointers, and generic methods to read values.
// (could use generated methods here that do not suffix the field type)
// decode__basic_name__length ???
tape.skip('read via generated apis', function (t) {
  
  t.equal(wasm.decode__basic_foo(start), expected.foo)
  t.equal(wasm.decode__basic_bar(start), expected.bar)
  t.equal(decode_string(wasm.decode__basic_name(start)), expected.name)
  var list = wasm.decode__basic_list(start)

  var table = wasm.__indirect_function_table
  console.log('table.length', table.length)
  // tried to pass in a js function to callback but it doesn't seem to work like that.
  //  table.grow(1)
  //  table.set(0, function (a, b) { return a === b })
  t.equal(wasm.ltp_decode_array_length__u8(list), expected.list.length)

  for(var i = 0; i < expected.list.length; i++) {
    console.log('list['+i+']='+wasm.ltp_decode_array_index__u8(list, i))
    t.equal(decode_string(wasm.ltp_decode_array_index__u8(list, i)), expected.list[i])
  }

  console.log([
    wasm.ltp_decode_array_index__u8(list, 0),
    wasm.ltp_decode_array_index__u8(list, 1),
    wasm.ltp_decode_array_index__u8(list, 2)
  ])

  //can look up indexes of matching strings
  for(var i = 0; i < expected.list.length; i++) {
    var last = wasm.ltp_decode_array_index__u8(list, i)
    t.equal(wasm.ltp_array_index_of__string_u8(list, last), i)
  }

    t.equal(wasm.ltp_array_index_of__string_u8(list, baz), 2)

//  t.equal(decode_string(), expected.name, expected name)
  t.end()
})

//*/
var expected2 = {foo: 1, bar: 1234, name: 'Hello, World!'} 


tape('encodedLength', function (t) {

  //note, endodedLength on schema S, which doesn't have the list
  //so the list bytes are ignored so the length is shorter.
  t.equal(S.encodedLength(memory, start), 22)
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
  var free = start+len+8
  memory.write('HELLO\x00', cstring, 'utf8')

/*
  wasm.encode__string_u8(string_u8, cstring, 5)
  console.log(memory.slice(string_u8, string_u8+7))
  t.equal(wasm.decode__length__string_u8(string_u8), 6)

  console.log(memory.slice(string_u8, string_u8+5))
  console.log(decode_string(string_u8))
*/
  var _len = wasm.encode__basic_name(start, strlen(cstring), cstring, free)
//  console.log(_len, strlen(cstring))
  console.log(memory.slice(free, free+_len))
  free += _len
//  free += len
  t.equal(_len, 1+6)
  
  console.log("DECODE NAME", memory.slice(start, free))
  t.equal(O.decode(memory, start).name, 'HELLO')
  t.equal(free, start+len+8+1+5+1)
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
//  var string_u8 = start+len+8
  memory.write('HELLO\x00', cstring, 'utf8')

  var cstring2 = cstring+1000

  function decode_cstring(s) {
    return memory.slice(s, s + strlen(s)).toString('utf8')
  }

  memcpy(cstring2, cstring, strlen(cstring))
  console.log('start-cstring2', decode_cstring(cstring2))
  

//  wasm.encode__string_u8(string_u8, cstring, 5)
 // t.equal(wasm.decode__length__string_u8(string_u8), 6)

//  console.log(memory.slice(string_u8, string_u8+1+5))
//  console.log(decode_string(string_u8))

//  wasm.encode__relp(start, string_u8,
  var free = start+6
  console.log('start-cstring', decode_cstring(cstring))
//  console.log('decode__basic_name',  wasm.encode__basic_name(start))
  t.equal(strlen(cstring), 5)
  free += wasm.encode__basic_name(start, strlen(cstring), cstring, free)
  t.equal(free, start+6+1+5+1, 'free pointer must be correct')
  console.log('raw', memory.slice(start, free+10))
  var cstring3 = wasm.decode__basic_name(start)
  console.log('start-cstring2', decode_cstring(cstring2))



  console.log('decode', S.decode(memory, start))
  console.log('raw', memory.slice(start, free+10))
  console.log('---')
  var _buffer = S.compact(memory, start)
  console.log(_buffer)

  t.equal(S.encodedLength(memory, start), 13) // 1 + 4 + 1 + 1 + 5 + 1
  t.deepEqual(S.decode(memory, start), expected3)

  console.log('decode', S.decode(_buffer, 0))
  t.equal(S.encodedLength(_buffer, 0), 13) // 1 + 4 + 1 + 1 + 5 + 1
  t.deepEqual(S.decode(_buffer, 0), expected3)
  t.end()
})

tape('single encode call', function (t) {
  var start2 = start+100
  var cstring2
  var string = 'HI THERE\x00'
  start2 += memory.write(string, cstring2=start2, 'utf8')
  console.log('hi there', memory.slice(cstring2, cstring2+10))
  //XXX strlen should not include the 0.
  t.equal(strlen(cstring2), string.length-1, "correct string length")
  var bytes = wasm.encode__simpler(start2, 100, 1000, strlen(cstring2), cstring2)
  console.log(memory.slice(start2, start2+32))
  console.log(bytes)
  t.deepEqual(S.decode(memory, start2), {foo: 100, bar: 1000, name: 'HI THERE'})

  var _bytes = wasm.encoding_length__simpler(strlen(cstring2))
  t.equal(_bytes, bytes, 'give correct encoding_length')

  t.end()
})
// note: bigName has a single field at position 5.
// so, 5 bytes of padding.
// I didn't realize that but worth testing that anyway.
tape('encode/decode string_u32', function (t) {
  var start2 = start+100
  var cstring2
  var string = 'LTP\x00'
  memory.write(string, cstring2=start2, 'utf8')
  var bytes = wasm.encode__bigName(start, strlen(cstring2), cstring2)
  console.log(memory.slice(start, start+32))
  t.equal(wasm.encoding_length__bigName(strlen(cstring2)), bytes)
  t.equal(bytes, 5+4+4+3+1)
//  t.deepEqual(BN.decode(memory, start2), {name: 'HI THERE'})
  t.end()

})

tape('encode/decode fpvs', function (t) {
  var start3 = start+350
  var _start3 = start+200
  var string = 'LTP\x00'
  var fixed_32 = start3+4
  var fixed_64 = fixed_32+32
  memory.write(string, cstring2=start3, 'utf8')
  var hash = crypto.createHash('sha256').update(string).digest()
  hash.copy(memory, fixed_32)
//  memory.write('0011223344556677889aabbccddeeff', fixed_16, 'utf8')
  var b = crypto.randomBytes(64)
  b.copy(memory, fixed_64)
  var bytes = wasm.encode__fixedbuf(_start3, 3, cstring2, fixed_32, fixed_64)
  t.equal(bytes, 2+4+32+64)
  t.equal(wasm.encoding_length__fixedbuf(3), bytes);
  console.log(memory.slice(_start3, _start3+100).toString('hex'))
  console.log(memory.slice(_start3+96, _start3+100).toString('hex'))
  t.deepEqual(
    F.decode(memory, _start3),
    {text: 'LTP', hash: hash, signature: b}
  )

  t.end()

})

tape('encode/decode type/length', function (t) {
  var start4 = start+1000
  var string = 'LTP\x00'
  memory.write(string, cstring2=start4+100, 'utf8')
  var bytes = wasm.encode__typeLengthBuf(start4, 3, cstring2)
  t.equal(wasm.decode__typeLengthBuf_type(start4), 0x99)
  t.equal(wasm.decode__typeLengthBuf_length(start4), 1+2+2+4)

  t.equal(bytes, 1+2 + 2+4)
  t.equal(wasm.encoding_length__typeLengthBuf(3), bytes)

  t.end()
})