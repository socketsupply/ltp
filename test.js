var tape = require('tape')
var ipd = require('./index')
var LengthDelimited = require('./length-delimited')

tape('encode decode a single byte', function (t) {
  var byte_field = ipd.Field('byte', 0, ipd.codex.u8) 
  var size = 1
  t.equal(ipd.getMinimumSize([byte_field]), size)

  var b = Buffer.alloc(size)

  var object_c = ipd.ObjectCodec([byte_field])
  var expected = {byte: 123}
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
  var expected = {u8: 123, u16:1_000, u32: 1_000_000}
  object_c.encode(expected, b, 0)
  t.deepEqual(object_c.decode(b, 0), expected)
  t.end()  
})

tape('encode/decode rel pointers', function (t) {
  var schema = [
    ipd.Field('hello', 0, ipd.codex.u32, ipd.codex.string_u32),
    ipd.Field('goodbye', 4, ipd.codex.u32, ipd.codex.string_u32)
  ]

  var expected = {hello: 'hello world!!!', goodbye: 'whatever'}
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
  var expected = {hello: 'hello world!!!', goodbye: 'whatever'}
  var size =  4 + 4+4 + 14 + 4+4 + 8
  t.equal(embed_codec.encodingLength(expected), size)

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
    ipd.Field('object', 4, ipd.codex.u32, embed_codec)
  ])

  var expected = {number: 7, object: {hello: 'hello world!!!', goodbye: 'whatever'}}

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
  var expected = {number: 7, array: [1, 2, 3, 1_000, 2_000, 3_000]}

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
    ipd.Field('string', 3, ipd.codex.u32, ipd.codex.string_u32)
  ]
  var expected = {u8:1, u16:1000, string: 'hello'}
  var codec = ipd.ObjectCodec(schema)
  var b = Buffer.alloc(1+2+ 4+4+5)
  codec.encode(expected, b, 0)
  var p = codec.dereference(b, 0, 1)
  t.equal(ipd.codex.u16.decode(b, p), expected.u16)
  var str_p = codec.dereference(b, 0, 2)
  t.equal(ipd.codex.string_u32.decode(b, str_p), expected.string)
  t.end()
})

//taking a path, drilling down and reading a field
//requires an inspectable structure representing the schema.
//currently, a codec represents a value, but it just closes
//over any subcodex, and so can encode/decode recursively
//but not 1

function drill (buffer, ptr, codec, path) {
  for(var i = 0; i < path.length; i++) {
    var index = path[i]
    //console.log('drill', {i, codec, index, path})
    ptr = codec.dereference(buffer, ptr, index)
    codec = codec.reflect(index)
  }
  return codec.decode(buffer, ptr)
}

tape('decode nested field', function (t) {

  var embed_codec = ipd.ObjectCodec([
    ipd.Field('hello', 0, ipd.codex.u32, ipd.codex.string_u32),
    ipd.Field('goodbye', 4, ipd.codex.u32, ipd.codex.string_u32)
  ])
  var container_codec = ipd.ObjectCodec([
    ipd.Field('number', 0, ipd.codex.u32),
    ipd.Field('number2', 4, ipd.codex.u32),
    ipd.Field('object', 8, ipd.codex.u32, embed_codec)
  ])
  var expected = {number:7, number2:13, object: {hello:'hello world!!!', goodbye: 'whatever'}}
  var size =  4 + 4 + 4 + 4+4 + 14 + 4+4 + 8
  t.equal(container_codec.encodingLength(expected), size)

  var b = Buffer.alloc(size)
  console.log(b)
  container_codec.encode(expected, b, 0)
  t.equal(drill(b, 0, container_codec, ['object', 'goodbye']), 'whatever')
  t.end()
})

tape('automatic length field', function (t) {
  var length_codec = ipd.ObjectCodec([
    ipd.LengthField('length', 0, ipd.codex.u8),
    ipd.Field('hello', 1, ipd.codex.u32, ipd.codex.string_u32),
    ipd.Field('goodbye', 5, ipd.codex.u32, ipd.codex.string_u32)
  ])

  var size = 1+ 4+4 +4+5 +4+7
  var expected = {length:size, hello:'hello', goodbye:'goodbye'}
  t.equal(length_codec.encodingLength(expected), size)
  var b = Buffer.alloc(size)
  length_codec.encode(expected, b, 0)
  console.log(b)
  t.deepEqual(length_codec.decode(b, 0), expected)

  //length field is automatic, encoding without length field will decode with it.
  var b2 = Buffer.alloc(size)
  var _expected = {hello:'hello', goodbye:'goodbye'}
  length_codec.encode(_expected, b2, 0)
  t.deepEqual(length_codec.decode(b2, 0), expected)


  t.end()
})

tape('isFixedSize', function (t) {
  var length_codec = ipd.ObjectCodec([
    ipd.LengthField('length', 0, ipd.codex.u8),
    ipd.Field('hello', 1, ipd.codex.u32, ipd.codex.string_u32),
    ipd.Field('goodbye', 5, ipd.codex.u32, ipd.codex.string_u32)
  ])
  t.equal(ipd.isFixedSize(length_codec), false)
  t.equal(ipd.isFixedSize(ipd.codex.u8), true)
  t.end()
})

tape('Field requires fixed size', function (t) {
  //note, it ought to be possible to have a variable length field
  //in the last position. (But it does mean you cannot add field after that)
  //because the field always starts in a fixed position.
  t.throws(() => {
    var invalid_codec = ipd.ObjectCodec([
      ipd.Field('hello', 0, ipd.codex.string_u32),
      ipd.Field('goodbye', 4, ipd.codex.u32)
    ])
  })
  t.end()
})

tape('nullable fields', function (t) {

  var nf_codec = ipd.ObjectCodec([
    ipd.LengthField('length', 0, ipd.codex.u8),
    ipd.Field('hello', 1, ipd.codex.u8, ipd.codex.string_u8, true),
    ipd.Field('goodbye', 2, ipd.codex.u8, ipd.codex.string_u8)
  ])

  var expected = {length: 0, goodbye:'GB'}
  var size = 1 + 1 + 1 + 1 + 2

  t.equal(nf_codec.encodingLength(expected), size)
  var b = Buffer.alloc(size)
  nf_codec.encode(expected, b, 0)

  //output will always include the null fields explicitly.
  t.deepEqual(nf_codec.decode(b, 0), {...expected, length: 6, hello: null})
  t.end()
})