var codex = require('./codex')
var {drill,
  isFixedSize, 
  Field, LengthField, isNonOverlapping, assertFixedSize, getMinimumSize 
} = require('./utils')
var ObjectCodec = require('./object')
var ArrayCodec = require('./array')


function DirectArrayCodec(length_codec, direct_codec) {
  return ArrayCodec(length_codec, direct_codec, null, false)
}
function PointedArrayCodec(length_codec, direct_codec, pointed_codec, isNullable) {
  if(!pointed_codec) throw new Error('pointed_codec must not be null')
  return ArrayCodec(length_codec, direct_codec, pointed_codec, isNullable)
}

module.exports = {
  isNonOverlapping, isFixedSize, assertFixedSize, drill,
  Field, LengthField, codex, ObjectCodec, getMinimumSize, LengthDelimited: codex.LengthDelimited,
  DirectArrayCodec,
  PointedArrayCodec,
  ArrayCodec
}