function encodingLength (codec, value) {
  return codec.bytes != null ?  codec.bytes : codec.encodingLength(value)
}

function LengthDelimited (id, length_codec, value_codec) {
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
    decode: (buffer, start) => {
      var length = length_codec.decode(buffer, start)
      var bytes = length_codec.bytes || length_codec.decode.bytes
      var value = value_codec.decode(buffer, start+bytes, start+bytes+length)
      ld.decode.bytes = bytes + value_codec.decode.bytes
      return value
    },
    encodingLength: (value) => {
      var length = value_codec.encodingLength(value)
      return encodingLength(length_codec, length) + length
    }
  }
}

module.exports = LengthDelimited