var tape = require('tape')
var ltp = require('../')
var LengthDelimited = require('../length-delimited')

var fixed = ltp.ObjectCodec([
  ltp.Field('u8', 0, ltp.codex.u8),
  ltp.Field('u16', 1, ltp.codex.u16),
  ltp.Field('u32', 3, ltp.codex.u32)
])

var hi_bye = ltp.ObjectCodec([
  ltp.Field('hello', 0, ltp.codex.u32, ltp.codex.string_u32),
  ltp.Field('goodbye', 4, ltp.codex.u32, ltp.codex.string_u32)
])

var object_string = ltp.ObjectCodec([
  ltp.Field('u8', 0, ltp.codex.u8),
  ltp.Field('u16', 1, ltp.codex.u16),
  ltp.Field('string', 3, ltp.codex.u32, ltp.codex.string_u32)
])

var embed = LengthDelimited(11, ltp.codex.u32, ltp.ObjectCodec([
  ltp.Field('hello', 0, ltp.codex.u32, ltp.codex.string_u32),
  ltp.Field('goodbye', 4, ltp.codex.u32, ltp.codex.string_u32)
]))

var container = ltp.ObjectCodec([
  ltp.Field('number', 0, ltp.codex.u32),
  ltp.Field('object', 4, ltp.codex.u32, embed)
])

var array_u32= ltp.ArrayCodec(ltp.codex.u32, ltp.codex.u32)
var array_container = ltp.ObjectCodec([
  ltp.Field('number', 0, ltp.codex.u32),
  ltp.Field('array', 4, ltp.codex.u32, array_u32)
])

tape('encode decode a single byte', function (t) {
  var byte_field = ltp.Field('byte', 0, ltp.codex.u8) 
  var size = 1
  t.equal(ltp.getMinimumSize([byte_field]), size)

  var b = Buffer.alloc(size)

  var object_c = ltp.ObjectCodec([byte_field])
  var expected = {byte: 123}
  object_c.encode(expected, b, 0)
  t.deepEqual(object_c.decode(b, 0), expected)
  t.end()  
})

tape('strings', function (t) {
  var strings = ['hello', 'HI', ""]
  strings.forEach(function (string) {
    for(var k in ltp.codex) {
      if(/string_/.test(k)) {
        var codec = ltp.codex[k]
        var b = Buffer.alloc(codec.encodingLength(string))
        codec.encode(string, b, 0)
        t.equal(codec.decode(b, 0), string)
    }}
  })
  t.end()
})

tape('encode decode three values', function (t) {

  var size = 7
  t.equal(fixed.bytes, size)

  var b = Buffer.alloc(size)

  var expected = {u8: 123, u16:1_000, u32: 1_000_000}
  fixed.encode(expected, b, 0)
  t.deepEqual(fixed.decode(b, 0), expected)
  t.end()  
})

tape('encode/decode rel pointers', function (t) {

  var expected = {hello: 'hello world!!!', goodbye: 'whatever'}
  var size = 4+4+14+4+4+8+1+1
//  t.equal(ltp.getMinimumSize(schema), 8)

  var b = Buffer.alloc(size)

  hi_bye.encode(expected, b, 0)
  t.equal(hi_bye.encodingLength(expected), size)

  console.log(b)
  t.deepEqual(hi_bye.decode(b, 0), expected)
  t.end()
})

//hmm, here an object is length delimited.
//in this method, the 

tape('object with length delimiter around it', function (t) {
  var expected = {hello: 'hello world!!!', goodbye: 'whatever'}
  var size =  4 + 4+4 + 14+1 + 4+4 + 8+1
  t.equal(embed.encodingLength(expected), size)

  var b = Buffer.alloc(size)

  embed.encode(expected, b, 0)
  t.deepEqual(embed.decode(b, 0), expected)
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

  var expected = {number: 7, object: {hello: 'hello world!!!', goodbye: 'whatever'}}

  var size =  4 + 4 + 4 + 4+4 + 14+1 + 4+4 + 8+1
  t.equal(container.encodingLength(expected), size)

  var b = Buffer.alloc(size)
  console.log(b)
  container.encode(expected, b, 0)
  t.deepEqual(container.decode(b, 0), expected)
  console.log(b)
  //26 00 00 00      //38
  //08 00 00 00      // 8 (rp)
  //16 00 00 00      //22 (rp)
  //0e 00 00 00 68 65 6c 6c 6f 20 77 6f 72 6c 64 21 21 21 //14 "hello world!!!"
  //08 00 00 00 77 68 61 74 65 76 65 72                   //8 "whatever"1
  t.end()
})

tape('array inside object', function (t) {
  var expected = {number: 7, array: [1, 2, 3, 1_000, 2_000, 3_000]}

  var size =  4 + 4 + 4 + 4*6
  t.equal(array_container.encodingLength(expected), size)

  var b = Buffer.alloc(size)
  console.log(b)
  array_container.encode(expected, b, 0)
  t.deepEqual(array_container.decode(b, 0), expected)
  console.log(b)
  console.log(array_container.decode(b, 0))
  //26 00 00 00      //38
  //08 00 00 00      // 8 (rp)
  //16 00 00 00      //22 (rp)
  //0e 00 00 00 68 65 6c 6c 6f 20 77 6f 72 6c 64 21 21 21 //14 "hello world!!!"
  //08 00 00 00 77 68 61 74 65 76 65 72                   //8 "whatever"1
  t.end()

})

tape('dereference pointer to specific direct field', function (t) {

  var expected = {u8:1, u16:1000, string: 'hello'}
  var b = Buffer.alloc(1+2+ 4+4+5+1)
  object_string.encode(expected, b, 0)
  var p = object_string.dereference(b, 0, 1)
  t.equal(ltp.codex.u16.decode(b, p), expected.u16)
  var str_p = object_string.dereference(b, 0, 2)
  t.equal(ltp.codex.string_u32.decode(b, str_p), expected.string)
  t.end()
})

tape('decode nested field', function (t) {
  var embed_codec = ltp.ObjectCodec([
    ltp.Field('hello', 0, ltp.codex.u32, ltp.codex.string_u32),
    ltp.Field('goodbye', 4, ltp.codex.u32, ltp.codex.string_u32)
  ])
  var container_codec = ltp.ObjectCodec([
    ltp.Field('number', 0, ltp.codex.u32),
    ltp.Field('number2', 4, ltp.codex.u32),
    ltp.Field('object', 8, ltp.codex.u32, embed_codec)
  ])

  var expected = {number:7, number2:13, object: {hello:'hello world!!!', goodbye: 'whatever'}}
  var size =  4 + 4 + 4 + 4+4 + 14+1 + 4+4 + 8+1
  t.equal(container_codec.encodingLength(expected), size)

  var b = Buffer.alloc(size)
  console.log(b)
  container_codec.encode(expected, b, 0)
  var decode_object_goodbye = ltp.drill(container_codec, ['object', 'goodbye'])
  t.equal(decode_object_goodbye(b, 0), 'whatever')
  t.end()
})

tape('automatic length field', function (t) {
  var length_codec = ltp.ObjectCodec([
    ltp.LengthField('length', 0, ltp.codex.u8),
    ltp.Field('hello', 1, ltp.codex.u32, ltp.codex.string_u32),
    ltp.Field('goodbye', 5, ltp.codex.u32, ltp.codex.string_u32)
  ])

  var size = 1+ 4+4 +4+5+1 +4+7+1
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
  var length_codec = ltp.ObjectCodec([
    ltp.LengthField('length', 0, ltp.codex.u8),
    ltp.Field('hello', 1, ltp.codex.u32, ltp.codex.string_u32),
    ltp.Field('goodbye', 5, ltp.codex.u32, ltp.codex.string_u32)
  ])
  t.equal(ltp.isFixedSize(length_codec), false)
  t.equal(ltp.isFixedSize(ltp.codex.u8), true)
  t.end()
})

tape('Field requires fixed size', function (t) {
  //note, it ought to be possible to have a variable length field
  //in the last position. (But it does mean you cannot add field after that)
  //because the field always starts in a fixed position.
  t.throws(() => {
    var invalid_codec = ltp.ObjectCodec([
      ltp.Field('hello', 0, ltp.codex.string_u32),
      ltp.Field('goodbye', 4, ltp.codex.u32)
    ])
  })
  t.end()
})

tape('nullable fields, objects', function (t) {

  var nf_codec = ltp.ObjectCodec([
    ltp.LengthField('length', 0, ltp.codex.u8),
    ltp.Field('hello', 1, ltp.codex.u8, ltp.codex.string_u8, true),
    ltp.Field('goodbye', 2, ltp.codex.u8, ltp.codex.string_u8)
  ])

  var expected = {length: 0, goodbye:'GB'}
  var size = 1 + 1 + 1 + 1 + 2 + 1

  t.equal(nf_codec.encodingLength(expected), size)
  var b = Buffer.alloc(size)
  nf_codec.encode(expected, b, 0)

  //output will always include the null fields explicitly.
  t.deepEqual(nf_codec.decode(b, 0), {...expected, length: 7, hello: null})
  t.end()
})

tape('nullable fields, arrays', function (t) {

  var nfa_codec = ltp.ArrayCodec(ltp.codex.u8, ltp.codex.u8, ltp.codex.string_u8, true)

  var expected = ['hello', , 'goodbye']
  var size = 1 + 3 + 1 + 5+1 + 1 + 7+1

  t.equal(nfa_codec.encodingLength(expected), size)
  var b = Buffer.alloc(size)
  nfa_codec.encode(expected, b, 0)

  //output will always include the null fields explicitly.
  t.deepEqual(nfa_codec.decode(b, 0), expected)
  t.end()
})

tape('nullable fields, drill', function (t) {

  var embed_codec = ltp.ObjectCodec([
    ltp.Field('hello', 0, ltp.codex.u32, ltp.codex.string_u32),
    ltp.Field('goodbye', 4, ltp.codex.u32, ltp.codex.string_u32)
  ])
  var container_codec = ltp.ObjectCodec([
    ltp.Field('number', 0, ltp.codex.u32),
    ltp.Field('number2', 4, ltp.codex.u32),
    ltp.Field('object', 8, ltp.codex.u32, embed_codec, true)
  ])
  var expected = {number:7, number2:13}
  var size =  4 + 4 + 4 //+ 4+4 + 14 + 4+4 + 8
  t.equal(container_codec.encodingLength(expected), size)
  
  var b = Buffer.alloc(size)
  container_codec.encode(expected, b, 0)
  console.log(b)
  var decode_object_goodbye = ltp.drill(container_codec, ['object', 'goodbye'])
  t.equal(decode_object_goodbye(b, 0), null)
  t.end()
})

tape('invalid schema', function (t) {
  var invalid_schema = [
    ltp.Field('number', 0, ltp.codex.u32),
    ltp.Field('number2', 1, ltp.codex.u16),
  ]
  var valid_schema = [
    ltp.Field('number', 0, ltp.codex.u32),
    ltp.Field('number2', 6, ltp.codex.u16),
  ]

  t.equal(ltp.isNonOverlapping(invalid_schema), false)
  t.equal(ltp.isNonOverlapping(valid_schema), true)

  t.throws(()=>
    ltp.ObjectCodec(invalid_schema)
  )
  t.end()
})

//it's far more important that decode safely handles invalid input than encode.
//since we are dealing with direct memory access and lengths
//it's possible to have a buffer overflow,
//as appeared in same famous security vulnerabilities in recent years

tape('handle invalid fields out of bounds', function (t) {
  var codec = ltp.ObjectCodec([
    ltp.LengthField('length', 0, ltp.codex.u8),
    ltp.Field('hello', 1, ltp.codex.u8, ltp.codex.string_u8)
  ])
  var size = codec.encodingLength({hello: 'hi'})
  var b = Buffer.alloc(size)
  codec.encode({hello: 'hi'}, b, 0)
  console.log(b) // [length, relp, length, 'h' 'i']
  t.deepEqual(codec.decode(b, 0), {length: 6, hello: 'hi'})

  var string_length = {message: /length out of bounds/}
  var relative_pointer  = {message: /relative pointer out of bounds/}
  var length_field = {message: /length field out of bounds/}

  var b2 = Buffer.from(b); b2[2] = b2[2]+1
  t.throws(()=> codec.decode(b2, 0, 6), string_length) //because incorrect length of hello
  var b3 = Buffer.from(b); b3[1] = (size-1)
  t.throws(()=> codec.decode(b3, 0, 6), relative_pointer) //because relative pointer points outside of end
  var b4 = Buffer.from(b); b4[0] = b4[0]+1
  t.throws(()=> codec.decode(b4, 0, 6), length_field) //because length field is greater outside of end (smaller would be okay)

  //because there is a defined length field,
  //ObjectCodec#decode will read that and pass to all methods underneath
  //so the first two invalid buffers should also fail without passing an explicit end.

  t.throws(()=> codec.decode(b2, 0), string_length) //because incorrect length of hello
  t.throws(()=> codec.decode(b3, 0), relative_pointer) //because relative pointer points outside of end

  t.end()
})

function createAssertErr(t) {
  return function (rx) { return {message: rx} } 
}

tape('handle invalid fields out of bounds, array', function (t) {
  var codec = ltp.ArrayCodec(ltp.codex.u8, ltp.codex.u8, ltp.codex.string_u8)
  var input = ['hi', 'bye']
  var size = codec.encodingLength(input)
  var b = Buffer.alloc(size)
  codec.encode(input, b, 0)
  t.deepEqual(codec.decode(b, 0), input)
  console.log(b) // [length, relp, length, 'h' 'i']

  var string_length = {message: /length out of bounds/}
  var relative_pointer  = {message: /relative pointer out of bounds/}
  var array_length  = {message: /array length out of bounds/}
  var b2 = Buffer.from(b); b2[7] = b2[7]+1
  t.throws(()=> { codec.decode(b2, 0, size) }, string_length) //incorrect length of 'bye'

  var b3 = Buffer.from(b); b3[3] = 9
  t.throws(()=> { codec.decode(b3, 0, size) }, string_length) //incorrect length of 'hi'

  //actually not invalid, because it still fits inside end.
  //checking a particular field overflows into other fields
  //but not outside the object is too complicated.
  //however, since it's still inside the attacker controlled data
  //it's not dangerous compared to reading arbitary memory
  var b4 = Buffer.from(b); b4[3] = 8 //b4[3] // 'hi\x00\x04bye'

  console.log(codec.decode(b4, 0, size)) //['hi\x00\x04bye', 'bye']
  t.deepEqual(codec.decode(b4, 0, size), ['hi\x00\x04bye', 'bye'])
  var b5 = Buffer.from(b); b5[2] = 10
  t.throws(()=> codec.decode(b5, 0, size), relative_pointer) //incorrect rel pointer
  var b6 = Buffer.from(b); b6[1] = 11
  t.throws(()=> codec.decode(b6, 0, size) , relative_pointer) //incorrect rel pointer
  console.log('array length out of bounds')
  var b7 = Buffer.from(b); b7[0] = 10
  t.throws(()=>
    codec.decode(b7, 0, 10), array_length
  ) //incorrect rel pointer

  /*
  var b4 = Buffer.from(b); b4[0] = 6
  t.throws(()=> codec.decode(b4, 0, 5)) //because length field is greater outside of end (smaller would be okay)

  //because there is a defined length field,
  //ObjectCodec#decode will read that and pass to all methods underneath
  //so the first two invalid buffers should also fail without passing an explicit end.

  t.throws(()=> codec.decode(b2, 0)) //because incorrect length of hello
  t.throws(()=> codec.decode(b3, 0)) //because relative pointer points outside of end
  */
  t.end()
})


tape('encode field that\'s too large to be expressed by length type', function (t) {
    var codec = ltp.ObjectCodec([
    ltp.LengthField('length', 0, ltp.codex.u8),
    ltp.Field('hello', 1, ltp.codex.u8, ltp.codex.string_u8)
  ])
  var l = 256
  var xs = Buffer.alloc(l).fill('x').toString()
  console.log(xs)
  t.equal(codec.encodingLength({hello: xs}), l+4)
  var b = Buffer.alloc(l+4)
  //fails because the string length is out of bounds
  t.throws(()=> {codec.encode({hello:xs}, b, 0)}, {message: 'u8 value out of bounds'})

  var l = 256-4
  var xs = Buffer.alloc(l).fill('x').toString()
  console.log(xs)
  t.equal(codec.encodingLength({hello: xs}), l+4)
  var b = Buffer.alloc(l+4)
  //fails because the object length is out of bounds
  t.throws(()=> {
    codec.encode({hello:xs}, b, 0)
  }, {message: 'u8 value out of bounds'})
  console.log(b)
  t.end()
})

tape('u{8,16,32,64} out of bounds checks', function (t) {
  var b = Buffer.alloc(8)
  t.throws(()=>ltp.codex.u8.encode(0x100, b, 0))
  t.throws(()=>ltp.codex.u16.encode(0x1_0000, b, 0))
  t.throws(()=>ltp.codex.u32.encode(0x1_0000_0000, b, 0))
  t.throws(()=>ltp.codex.u64.encode(0x1_0000_0000_0000_0000n, b, 0))

  t.throws(()=>ltp.codex.u8.encode(-1, b, 0))
  t.throws(()=>ltp.codex.u16.encode(-1, b, 0))
  t.throws(()=>ltp.codex.u32.encode(-1, b, 0))
  //u64 accepts numbers or big int
  t.throws(()=>ltp.codex.u64.encode(-1, b, 0))
  t.throws(()=>ltp.codex.u64.encode(-1n, b, 0))
  t.end()

})

tape('fixed position variable sized field', function (t) {
  var codec = ltp.ObjectCodec([
    ltp.Field('foo', 0, ltp.codex.u8),
    ltp.FixedPositionVariableSizeField('bar', 1, ltp.codex.string_u8)
  ])
  var b = Buffer.alloc(1+1+3+1)
  var expected = {foo: 10, bar: 'baz'}
  codec.encode(expected, b, 0)
  t.deepEqual(codec.decode(b, 0), expected)

  var b = Buffer.alloc(1+1+0+1)
  var expected = {foo: 10, bar: ''}
  codec.encode(expected, b, 0)
  t.deepEqual(codec.decode(b, 0), expected)

  t.end()
})

tape('fixed position variable sized field must fail if not in last position', function (t) {
  t.throws(()=> {ltp.ObjectCodec([
    ltp.Field('foo', 1, ltp.codex.u8),
    ltp.FixedPositionVariableSizeField('bar', 0, ltp.codex.string_u8)
//    ltp.Field('bar', 1, Constant(0), ltp.codex.string_u8, false)
  ])})
  t.end()
})

function encodeAll(codec, ary, b) {
  var start = 0
  for(var i = 0; i < ary.length;i++) {
    codec.encode(ary[i], b, start)
    start += codec.encode.bytes
  }
  return start
}

function decodeAll(codec, _ary, b, count, t) {
  var start = 0
  for(var i = 0; i < count; i++) {
    _ary[i] = codec.decode(b, start)
    var _start = start
    start += codec.decode.bytes
    console.log(_start, codec.decode.bytes, start)
    if(t) t.equal(_start + codec.encodedLength(b, _start), start, 'expected getNext to match start+decode.bytes')
  }
  return start
}

tape('getNext, fixed size', function (t) {
  var schema = [
    ltp.Field('u8', 0, ltp.codex.u8),
    ltp.Field('u16', 1, ltp.codex.u16),
    ltp.Field('u32', 3, ltp.codex.u32)
  ]

  var size = 7
  t.equal(ltp.getMinimumSize(schema), size)

  var b = Buffer.alloc(size*3)

  var object_c = ltp.ObjectCodec(schema)
  var expected = [
    {u8: 12, u16:1_000, u32: 1_000_000},
    {u8: 34, u16:2_000, u32: 2_000_000},
    {u8: 56, u16:3_000, u32: 3_000_000}
  ]

  var start = encodeAll(object_c, expected, b) 
  t.equal(start, size*(expected.length))

  t.deepEqual(0 + object_c.encodedLength(b, 0), size)

  var actual = []
  var start2 = decodeAll(object_c, actual, b, 3, t)
  t.equal(start, start2)
  t.deepEqual(actual, expected)
  t.end()
})

tape('getNext, variable sized, length delimited', function (t) {
  var schema = [
    ltp.LengthField('length', 0, ltp.codex.u16),
    ltp.Field('first', 2, ltp.codex.u16, ltp.codex.string_u8),
    ltp.Field('last', 4, ltp.codex.u16, ltp.codex.string_u8),
    ltp.Field('age', 6, ltp.codex.u16)
  ]

  t.equal(ltp.getMinimumSize(schema), 8)

  var b = Buffer.alloc(1024)

  var object_c = ltp.ObjectCodec(schema)
  var expected = [
    {first: 'alice', last: 'algorithm', age: 36},
    {first: 'bob', last: 'binary', age: 64},
    {first: 'carol', last: 'commutative', age: 12}
  ]

  var start = encodeAll(object_c, expected, b) 

  var actual = []
  var start2 = decodeAll(object_c, actual, b, 3, t)
  t.equal(start, start2)
  t.deepEqual(actual.map(({first, last, age}) => ({first, last, age})), expected)
  t.end()
})


tape('length delimited, with offset', function (t) {
  var schema = [
    ltp.LengthField('length', 0, ltp.codex.u16, 2),
    ltp.Field('first', 2, ltp.codex.u16, ltp.codex.string_u8),
    ltp.Field('last', 4, ltp.codex.u16, ltp.codex.string_u8),
    ltp.Field('age', 6, ltp.codex.u16)
  ]

  t.equal(ltp.getMinimumSize(schema), 8)

  var b = Buffer.alloc(1024)

  var object_c = ltp.ObjectCodec(schema)
  var expected = [
    {first: 'alice', last: 'algorithm', age: 36},
    {first: 'bob', last: 'binary', age: 64},
    {first: 'carol', last: 'commutative', age: 12}
  ]

  var l = object_c.encodingLength(expected[0])
  console.log(l)
  var l = object_c.encodingLength(expected[0])
  var b = Buffer.alloc(l)
  object_c.encode(expected[0], b)
  t.equal(object_c.encodedLength(b, 0), l)
  console.log(object_c.dereference(b, 0, 'length'))
  console.log(object_c.reflect(0).decode(b, 0))
  console.log(b)
  t.end()
})
return

tape('getNext, single variable sized field', function (t) {
  var schema = [
    ltp.Field('age', 0, ltp.codex.u16),
    ltp.FixedPositionVariableSizeField('name', 2, ltp.codex.string_u8),
  ]

  var b = Buffer.alloc(1024)

  var object_c = ltp.ObjectCodec(schema)
  var expected = [
    {name: 'alice', age: 36},
    {name: 'bob', age: 64},
    {name: 'carol', age: 12}
  ]

  var start = encodeAll(object_c, expected, b) 

  var actual = []
  var start2 = decodeAll(object_c, actual, b, 3, t)
  t.equal(start, start2)
  t.deepEqual(actual, expected)
  t.equal(start, start2)
  t.end()
})
