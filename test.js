var tape = require('tape')
var ipd = require('./index')


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

tape('embedded object', function (t) {
  var embed_codec = ipd.LengthDelimited(11, ipd.codex.u32, ipd.ObjectCodec([
    ipd.Field('hello', 0, ipd.codex.u32, ipd.codex.string_u32),
    ipd.Field('goodbye', 4, ipd.codex.u32, ipd.codex.string_u32)
  ]))
/*
  var wrap_codec = ipd.ObjectCodec([
    {position: 0, direct: ipd.codex.u32},
    {position: 4, direct: ipd.codex.u32, pointed: embed_codec
  ])
  var size = 4+4+14+4+4+8
  var b = buffer.alloc( 
*/
  t.end()
})