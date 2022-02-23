var tape = require('tape')
var ipd = require('./index')
var LengthDelimited = require('./length-delimited')

tape('encode decode a single byte', function (t) {
  var byte_field = ipd.Field('byte', 0, ipd.codex.u8) 
  var size = 1
  t.equal(ipd.getMinimumSize([byte_field]), size)

  var b = Buffer.alloc(size)

  var object_c = ipd.ObjectCodec([byte_field])
  var expected = [123]
  object_c.encode(expected, b, 0)
  t.deepEqual(object_c.decode(b, 0), expected)
  t.end()  
})

tape('encode decode three values', function (t) {
  var schema = [
    ipd.Field('u8', 0, ipd.codex.u8),
    ipd.Field('u16', 1, ipd.codex.u16),
    ipd.Field('u32', 3, ipd.codex.u32)
  ]

  var size = 7
  t.equal(ipd.getMinimumSize(schema), size)

  var b = Buffer.alloc(size)

  var object_c = ipd.ObjectCodec(schema)
  var expected = [123, 1_000, 1_000_000]
  object_c.encode(expected, b, 0)
  t.deepEqual(object_c.decode(b, 0), expected)
  t.end()  
})

tape('encode/decode rel pointers', function (t) {
  var schema = [
    ipd.Field('hello', 0, ipd.codex.u32, ipd.codex.string_u32),
    ipd.Field('goodbye', 4, ipd.codex.u32, ipd.codex.string_u32)
  ]

  var expected = ['hello world!!!', 'whatever']
  var size = 4+4+14+4+4+8
  t.equal(ipd.getMinimumSize(schema), 8)

  var b = Buffer.alloc(size)

  var object_c = ipd.ObjectCodec(schema)
  object_c.encode(expected, b, 0)
  t.equal(object_c.encodingLength(expected), size)

  console.log(b)
  t.deepEqual(object_c.decode(b, 0), expected)
  t.end()
})

//hmm, here an object is length delimited.
//in this method, the 

tape('object with length delimiter around it', function (t) {
  var embed_codec = LengthDelimited(11, ipd.codex.u32, ipd.ObjectCodec([
    ipd.Field('hello', 0, ipd.codex.u32, ipd.codex.string_u32),
    ipd.Field('goodbye', 4, ipd.codex.u32, ipd.codex.string_u32)
  ]))
  var expected = ['hello world!!!', 'whatever']
  var size =  4 + 4+4 + 14 + 4+4 + 8
  t.equal(embed_codec.encodingLength( ['hello world!!!', 'whatever']), size)

  var b = Buffer.alloc(size)

  embed_codec.encode(expected, b, 0)
  t.deepEqual(embed_codec.decode(b, 0), expected)
  console.log(b)
  //26 00 00 00      //38
  //08 00 00 00      // 8 (rp)
  //16 00 00 00      //22 (rp)
  //0e 00 00 00 68 65 6c 6c 6f 20 77 6f 72 6c 64 21 21 21 //14 "hello world!!!"
  //08 00 00 00 77 68 61 74 65 76 65 72                   //8 "whatever"1
  t.end()
})

//it should also be possible to have a pointed object _without_ a length
//delimiter, because the type is known, so therefore the fixed size section is known
//encoding returns the bytes used, so pointed values are in the same space.

tape('object embedded in another object', function (t) {
  var embed_codec = LengthDelimited(11, ipd.codex.u32, ipd.ObjectCodec([
    ipd.Field('hello', 0, ipd.codex.u32, ipd.codex.string_u32),
    ipd.Field('goodbye', 4, ipd.codex.u32, ipd.codex.string_u32)
  ]))
  var container_codec = ipd.ObjectCodec([
    ipd.Field('number', 0, ipd.codex.u32),
    ipd.Field('number', 4, ipd.codex.u32, embed_codec)
  ])
  var expected = [7, ['hello world!!!', 'whatever']]

  var size =  4 + 4 + 4 + 4+4 + 14 + 4+4 + 8
  t.equal(container_codec.encodingLength(expected), size)

  var b = Buffer.alloc(size)
  console.log(b)
  container_codec.encode(expected, b, 0)
  t.deepEqual(container_codec.decode(b, 0), expected)
  console.log(b)
  //26 00 00 00      //38
  //08 00 00 00      // 8 (rp)
  //16 00 00 00      //22 (rp)
  //0e 00 00 00 68 65 6c 6c 6f 20 77 6f 72 6c 64 21 21 21 //14 "hello world!!!"
  //08 00 00 00 77 68 61 74 65 76 65 72                   //8 "whatever"1
  t.end()
})

tape('array inside object', function (t) {
  var embed_codec = ipd.ArrayCodec(ipd.codex.u32, ipd.codex.u32)
  var container_codec = ipd.ObjectCodec([
    ipd.Field('number', 0, ipd.codex.u32),
    ipd.Field('array', 4, ipd.codex.u32, embed_codec)
  ])
  var expected = [7, [1, 2, 3, 1_000, 2_000, 3_000]]

  var size =  4 + 4 + 4 + 4*6
  t.equal(container_codec.encodingLength(expected), size)

  var b = Buffer.alloc(size)
  console.log(b)
  container_codec.encode(expected, b, 0)
  t.deepEqual(container_codec.decode(b, 0), expected)
  console.log(b)
  console.log(container_codec.decode(b, 0))
  //26 00 00 00      //38
  //08 00 00 00      // 8 (rp)
  //16 00 00 00      //22 (rp)
  //0e 00 00 00 68 65 6c 6c 6f 20 77 6f 72 6c 64 21 21 21 //14 "hello world!!!"
  //08 00 00 00 77 68 61 74 65 76 65 72                   //8 "whatever"1
  t.end()

})

tape('dereference pointer to specific direct field', function (t) {
  var schema = [
    ipd.Field('u8', 0, ipd.codex.u8),
    ipd.Field('u16', 1, ipd.codex.u16),
    ipd.Field('u32', 3, ipd.codex.u32, ipd.codex.string_u32)
  ]
  var expected = [1, 1000, 'hello']
  var codec = ipd.ObjectCodec(schema)
  var b = Buffer.alloc(1+2+ 4+4+5)
  codec.encode(expected, b, 0)
  var p = codec.dereference(1, b, 0)
  t.equal(ipd.codex.u16.decode(b, p), expected[1])
  var str_p = codec.dereference(2, b, 0)
  t.equal(ipd.codex.string_u32.decode(b, str_p), expected[2])
  t.end()
})

