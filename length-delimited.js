function encodingLength (codec, value) {
  return codec.bytes != null ?  codec.bytes : codec.encodingLength(value)
}

function LengthDelimited (id, length_codec, value_codec) {
  if(!length_codec.bytes) throw new Error('expected length_codec to be fixed length integer codec')
  var ld
  return ld = {
    type: id,
    encode: (value, buffer, start) => {
      if(isNaN(start)) throw new Error('start cannot be nan')
      length_codec.encode(value_codec.encodingLength(value), buffer, start)
      var bytes = length_codec.bytes || length_codec.encode.bytes
      value_codec.encode(value, buffer, start+bytes)
      return ld.encode.bytes = bytes + value_codec.encode.bytes
    },
    decode: (buffer, start, end) => {
      var length = length_codec.decode(buffer, start)
      if(start + length >= end) throw new Error('string length out of bounds')
      var bytes = length_codec.bytes || length_codec.decode.bytes
      var value = value_codec.decode(buffer, start+bytes, start+bytes+length)
      ld.decode.bytes = bytes + value_codec.decode.bytes
      return value
    },
    encodingLength: (value) => {
      var length = value_codec.encodingLength(value)
      return encodingLength(length_codec, length) + length
    },
    encodedLength: (buffer, start, end) => {
      if(end < start + length_codec.bytes)
        throw new Error('input buffer out of bounds')
      var length = length_codec.decode(buffer, start)
      return (length_codec.bytes || length_codec.decode.bytes) + length
    }
  }
}

module.exports = LengthDelimited