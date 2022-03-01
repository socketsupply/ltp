var codex = require('./codex')

function isFixedSize(codec) {
  return !isNaN(codec.bytes)
}

function assertFixedSize(codec) {
  if(!codec) throw new Error('expected a fixed size codec, got:'+codec)
  if(!isFixedSize(codec)) throw new Error('codec must be fixed size')
  return codec
}

function Field (name, position, direct, pointed, isNullable=true) {
  assertFixedSize(direct)
  return {
    name, position, direct, pointed, isNullable
  }
}

function LengthField (name, position, direct) {
  assertFixedSize(direct)
  if(position !== 0) throw new Error('length position must be zero')
  return {
    name, position: 0, direct, isLength: true
  }
}


//because the schema could use padding, find the max position + size of that field.
//because of things like bit packed booleans that might overlap with larger numbers
//for example, an u64 with a boolean packed into the upper bits (which are at the end, in little endian)

//note, a single variable sized direct field is allowed,
//because it always starts at the same position.

function getMinimumSize(schema) {
  if(!schema.length) return 0 //or should an empty schema be a throw?
  var size = 0
  for(var i = 0; i < schema.length; i++) {
    var field = schema[i]
    size = Math.max(size, field.position + field.direct.bytes)
  }
  return size   
}


//does the codec type include the pointer?
//the assumption with varstruct is that something encodes and it has a length.
//in this model, there is a pointer, then later more bytes.
//so the bytes used are not adjacent.
//so the pointer has a type, and the pointed has a type.

/*
field: {
  type: POINTER|DIRECT,
  direct: codec u{8,16,32,64}
  pointed: codec
  position:
  name: 
}
*/

function encodeField(position, direct, pointed, value, buffer, start, free) {
  assertFixedSize(direct)
  if(direct && !pointed) {
    direct.encode(value, buffer, start + position)
    //return new free value
    return 0 //field.value_codec.encode.bytes
  }
  else if(pointed && direct) {
    ///XXX should it be (start + free)?
    if(value != null) {
      direct.encode(free - position, buffer, start + position)
      pointed.encode(value, buffer, start+free)
      return pointed.encode.bytes
    }
    else {
      direct.encode(0, buffer, start + position)
      return 0
    }
  }
  else 
    throw new Error('invalid field, must be direct or pointed & direct')
}

function decodeField (position, direct, pointed, buffer, start) {
  if(!direct)
    throw new Error('field must have direct codec')

  if(!pointed)
    return direct.decode(buffer, start + position)
  else if (pointed) {
    var rel = direct.decode(buffer, start + position)
    return rel === 0 ? null : pointed.decode(buffer, start + position + rel)
  }
}

function ObjectCodec(schema) {
  var min = getMinimumSize(schema)

  function encode (obj, buffer, start, end) {
    var free = min
    if(isNaN(free)) throw new Error('min size was nan')
    for(var i = 0; i < schema.length; i++) {
      var field = schema[i]
      if(!field.isLength) {
        var value = obj[field.name]
        free += encodeField(field.position, field.direct, field.pointed, value, buffer, start, free)
        if(isNaN(free)) throw new Error('free was nan after field:'+i)
      }
    }

    //the length field must be first
    if(schema[0].isLength) {
      var field = schema[0]
      encodeField(field.position, field.direct, null, free, buffer, start)
    }
    
    //if this was encoded as a pointed field
    //we need to know how far the free pointer has moved.
    //hmm, encodeField returns only the pointed bytes used
    //not the direct bytes, but that's an private interface.
    //other encoders
    encode.bytes = free
  }

  function decode (buffer, start, end) {
    var a = {} //new Array(schema.length)
    for(var i = 0; i < schema.length; i++) {
      var field = schema[i]
      a[field.name] = decodeField(field.position, field.direct, field.pointed, buffer, start)
    }
    //decode.bytes = ??? 
    return a
  }

  //I want to be able to decode a path.
  //foo.bar.baz[10] and do a fixed number of reads
  //and then decode the value (hopefully a primitive)

  function get_field (index) {
    return Number.isInteger(index) ? schema[index] : schema.find(v => v.name == index)
  }

  function dereference (buffer, start, index) {
    var length = min
    var field = get_field(index)
    if(!field) throw new Error('cannot dereference invalid field:' + index)
    var position = field.position
    if(!field.pointed)
      //might be a embedded fixed sized value, not a primitive
      //so better to return pointer than to decode here
      return start + position //return pointer to direct value
    else {
      var relp = field.direct.decode(buffer, start + position)
      if(relp === 0) return -1
      return (start + position) + relp
    }
  }

  function reflect (index) {
    var field = get_field(index)
    if(!field) throw new Error('invalid field:'+index)
    return field.pointed ? field.pointed : field.direct
  }

  function encodingLength (value) {
    var v_size = 0
    for(var i = 0; i < schema.length; i++) {
      var field = schema[i]
      if(field.pointed) {
        var fv = value[field.name]
        if(fv != null)
          v_size += field.pointed.encodingLength(fv)
        else if(!field.isNullable)
          throw new Error('field:'+field.name+' is not nullable, but no value provided')
      }
    }
    return min + v_size
  }

  return {
    type:'object',
    encode, decode, dereference, reflect, encodingLength//, encodedLength
  }
}

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

function drill (codec, path) {
  var codex = new Array(path.length) // path.map(index => codec = codec.reflect(index))
  for(var i = 0; i < path.length; i++) {
    codex[i] = codec
    codec = codec.reflect(path[i])
  }
  
  return function (buffer, ptr) {
    for(var i = 0; i < path.length; i++) {
      var index = path[i]
      //console.log('drill', {i, codec, index, path})
      ptr = codex[i].dereference(buffer, ptr, index)
      //check for null pointers.
      if(ptr === -1) return null

    }
    return codec.decode(buffer, ptr)
  }
}


module.exports = {
  isFixedSize, assertFixedSize, drill,
  Field, LengthField, codex, ObjectCodec, getMinimumSize, LengthDelimited: codex.LengthDelimited, ArrayCodec
}