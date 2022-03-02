var codex = require('./codex')
var {drill,
  isFixedSize, 
  Field, LengthField, isNonOverlapping, assertFixedSize, getMinimumSize 
} = require('./utils')
var ObjectCodec = require('./object')
var ArrayCodec = require('./array')


module.exports = {
  isNonOverlapping, isFixedSize, assertFixedSize, drill,
  Field, LengthField, codex, ObjectCodec, getMinimumSize, LengthDelimited: codex.LengthDelimited, ArrayCodec
}