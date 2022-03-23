var ipd = require('../')
var Any = require('../any')
var tape = require('tape')
//var ObjectCodec = require('../object')

var fixed = ipd.ObjectCodec([
  ipd.Field('u8', 0, ipd.codex.u8),
  ipd.Field('u16', 1, ipd.codex.u16),
  ipd.Field('u32', 3, ipd.codex.u32)
])

var hi_bye = ipd.ObjectCodec([
  ipd.Field('hello', 0, ipd.codex.u32, ipd.codex.string_u32),
  ipd.Field('goodbye', 4, ipd.codex.u32, ipd.codex.string_u32)
])

var object_string = ipd.ObjectCodec([
  ipd.Field('u8', 0, ipd.codex.u8),
  ipd.Field('u16', 1, ipd.codex.u16),
  ipd.FixedPositionVariableSizeField('string', 3, ipd.codex.string_u32)
])

var map = {1: fixed, 2:hi_bye, 3:object_string}

var lookup = (type) => map[type]

var any = Any(ipd.codex.u8, ipd.codex.u16, lookup)
var any2 = Any.AnyPointer(ipd.codex.u8, ipd.codex.u16, (type) => map[type])

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

