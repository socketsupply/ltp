var {getMinimumSize, assertNonOverlapping, encodeField, decodeField} = require('./utils')

function ArrayCodec (length_c, direct_c, pointed_c=null) {
  //the minimum size is the length used to encode 0
  var empty_size = length_c.bytes
  //note. pointed_codec is optional.
  //direct_codec must be fixed size.
  function encode (value, buffer, start) {
    //write the length
    length_c.encode(value.length*direct_c.bytes, buffer, start)
    var array_start = length_c.bytes
    var free = array_start + value.length * direct_c.bytes
    //encode into positions, basically the same code as for encoding a struct
    //except that the codec's are the same and, the position is i*
    for(var i = 0; i < value.length; i++) {
      var item = value[i]
      var position = array_start + i*direct_c.bytes
      free += encodeField(position, direct_c, pointed_c, item, buffer, start, free)
    }
    encode.bytes = free
  }

  function decode (buffer, start) {
    var length = length_c.decode(buffer, start)
    var array_start = length_c.bytes
    var items = length / direct_c.bytes
    var a = new Array(items)
    for(var i = 0; i < items; i++) {
      var position = array_start + i*direct_c.bytes
      var value = decodeField(position, direct_c, pointed_c, buffer, start)
      if(value != null)
        a[i] = value
    }
    return a
  }

  //actually we don't want to decode the field
  //we want to either return the direct value
  //or a pointer to the indirect.

  function dereference (buffer, start, index) {
    var length = length_c.decode(buffer, start)
    var array_start = length_c.bytes
    var items = length / direct_c.bytes
    if(index < 0 || index >= items) return undefined
    var position = array_start + index*direct_c.bytes
    if(!pointed_c)
      return start + position //return pointer to direct value
    else {
      var relp = direct_c.decode(buffer, start + position)
      if(relp === 0) return -1
      return (start + position) + relp
    }
  }

  //so... we need a method to return the codec at an index.
  //an array should always use one field type.
  //...and the length isn't addressable.
  //in this case, 

  function reflect (_) {
    return pointed_c ? pointed_c : direct_c
  }

  function encodingLength (value) {
    var base = length_c.bytes + direct_c.bytes * value.length
    if(pointed_c)
      return base + value.reduce((size, item) => size + pointed_c.encodingLength(item), 0)
    return base
  }

  return {
    isArray: true,
    encode, decode, encodingLength, dereference, reflect
  }
}

module.exports = ArrayCodec