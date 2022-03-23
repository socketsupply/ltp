
module.exports = function (type_codec, length_codec, codec_lookup, decodePointer) {
  //[type, length, value]
  //not [length, type, value] because then it's the same as

  function encode ({type, value}, buffer, start) {
    type_codec.encode(type, buffer, start)
    var bytes = type_codec.bytes
    //note, length is written after the value is,
    //so we don't have to call encodingLength and then encode
    var length_pos = start + type_codec.bytes

    var codec = codec_lookup(type)
    codec.encode(value, buffer, start + type_codec.bytes + length_codec.bytes)

    var value_length = codec.encode.bytes
    bytes += value_length
    length_codec.encode(value_length, buffer, length_pos)

    encode.bytes = value_length + length_codec.bytes + type_codec.bytes
  }

  function decode (buffer, start, end=buffer.length) {
    var type = type_codec.decode(buffer, start, end)
    var length = length_codec.decode(buffer, start + type_codec.bytes, end)
    var _start = start + type_codec.bytes + length_codec.bytes
    var _end = Math.min(end, _start+length)
    var codec = codec_lookup(type)
    decode.bytes = end - start
    if(decodePointer)
      return {type, length, value:_start}

    var value = codec.decode(buffer, _start , end)
    return {type, value}
  }

  return {
    type:'any',
    encode, decode,
    encodingLength: ({type, value}) => {
     return type_codec.bytes + length_codec.bytes + codec_lookup(type).encodingLength(value)
    },
    encodedLength: (buffer, start) => {
      return type_codec.bytes + length_codec.decode(buffer, start + type_codec.bytes) + length_codec.bytes
    }
  }
}

module.exports.AnyPointer = function (type, length, lookup) {
  return module.exports(type, length, lookup, true)
}