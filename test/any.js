var ltp = require('../')
var Any = require('../any')
var tape = require('tape')
//var ObjectCodec = require('../object')

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
  ltp.FixedPositionVariableSizeField('string', 3, ltp.codex.string_u32)
])

var map = {1: fixed, 2:hi_bye, 3:object_string}

var lookup = (type) => map[type]

var any = Any(ltp.codex.u8, ltp.codex.u16, lookup)
var any2 = Any.AnyPointer(ltp.codex.u8, ltp.codex.u16, (type) => map[type])

var inputs = [
  {type: 1, value: {u8:1, u16: 1_000, u32: 1_000_000}},
  {type: 2, value: {hello: 'why hello', goodbye: 'see ya later'}},
  {type: 3, value: {u8:1, u16: 1_000, string: 'hello world'}},
]

tape('encode, decode', function (t) {
  for(var i in inputs) {
    var {type, value} = inputs[i]

    var len = any.encodingLength({type: type, value})
    var b = Buffer.alloc(len)
    any.encode({type, value}, b, 0)
    var bytes = any.encode.bytes
    t.equal(bytes, len)
    t.equal(any.encodedLength(b, 0), bytes)
    var actual = any.decode(b, 0)
    t.equal(any.decode.bytes, bytes)
    t.deepEqual(actual, {type, value})
    var op = any2.decode(b, 0)
    t.equal(op.type, type)
    console.log(op)
    t.deepEqual(lookup(type).decode(b, op.value, op.value+op.length), value)

  }  
  t.end()
})

