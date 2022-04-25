var test = require('tape')
var ltp
var {TypeField, DirectField, PointedField, LengthField} = ltp = require('../')
var {u32, u8, string_u8} = require('../codex')
var Any = require('../any2')
var schemas = [
  [ //type1 direct only
    TypeField('type', 0, u8, 0x11, 'direct_only'),
    LengthField('length', 1, u8),
    DirectField('count', 3, u32)
  ],
  [ //type1 direct only
    TypeField('type', 0, u8, 0x22, 'pointed_only'),
    LengthField('length', 1, u8),
    PointedField('name', 2, u8, string_u8)
  ],
  [ //type1 direct only
    TypeField('type', 0, u8, 0x33, 'direct_and_pointed'),
    LengthField('length', 1, u8),
    DirectField('count', 2, u32),
    PointedField('name', 6, u8, string_u8)
  ],

].map(ltp.ObjectCodec)

var any = Any(schemas)

var input = [
  {type: 'direct_only', length: null, count: 12345},
  {type: 'pointed_only', length: null, name: 'foobar'},
  {type: 'direct_and_pointed', length: null, count: 9876, name: 'baz'}
]

test('basic encode decode', function (t) {
  var len = 0
  input.forEach(v => len += any.encodingLength(v))
//  return
  var b = Buffer.alloc(len)
  var start = 0
  input.forEach(v => {
    var r = any.encode(v, b, start)
    t.ok(Number.isInteger(r))
    start += r
  })
  t.equal(start, len)
  var start2 = 0
  input.forEach(expected => {
    var actual = any.decode(b, start2)
    var encoded_length = any.encodedLength(b, start2)
    t.deepEqual({...actual, length: null}, expected)
    start2 += actual.length
    t.equal(encoded_length, actual.length)
  })


  t.end()
})