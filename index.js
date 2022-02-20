
function encodingLength (codec, value) {
  return codec.bytes != null ?  codec.bytes : codec.encodingLength(value)
}

var codex = {
  u8: {
    encode: (value, buffer, start) => { buffer[start] = value & 0xff },
    decode: (buffer, start) => buffer[start] & 0xff,
    bytes: 1,
  },
  u16: {
    encode: (value, buffer, start) => { buffer.writeUint16LE(value, start) },
    decode: (buffer, start) => buffer.readUint16LE(start),
    bytes: 2,
  },
  u32: {
    encode: (value, buffer, start) => { buffer.writeUint32LE(value, start) },
    decode: (buffer, start) => buffer.readUint32LE(start),
    bytes: 4,
  },
  u64: {
//    encode (value, buffer, start) => { buffer.writeUint32LE(value, start),
//    decode: (buffer, start) => buffer.readUint32LE(start),
    bytes: 8
  }
  //i8, i16, i32, i64 ...
  
}

function Field (name, position, direct, pointed) {
  return {
    name, position, direct, pointed
  }
}

var string = {
  encode: (value, buffer, start) => {
    var bytes = Buffer.byteLength(value)
    console.log(value, buffer, start, bytes)
    buffer.write(value, start, start+bytes)
    string.encode.bytes = bytes
  },
  decode: (buffer, start, end) => {
    var value = buffer.toString('utf8', start, end)
    string.decode.bytes = end - start
    return value
  },
  encodingLength: (value) => Buffer.byteLength(value, 'utf8')
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

codex.string_u32 = LengthDelimited(0x10, codex.u32, string)

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

function encodeField(field, value, buffer, start, free) {
  if(field.direct && !field.pointed) {
    field.direct.encode(value, buffer, start + field.position)
    //return new free value
    return 0 //field.value_codec.encode.bytes
  }
  else if(field.pointed && field.direct) {
    field.direct.encode(free - field.position, buffer, start + field.position)
    field.pointed.encode(value, buffer, free)
    return field.pointed.encode.bytes
  }
  else 
    throw new Error('invalid field, must be direct or pointed & direct')
}

function decodeField (field, buffer, start) {
  if(field.direct && !field.pointed)
    return field.direct.decode(buffer, start + field.position)
  else if (field.direct && field.pointed) {
    var rel = field.direct.decode(buffer, start + field.position)
    return field.pointed.decode(buffer, start + field.position + rel)
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

function ObjectCodec(schema) {
  var min = getMinimumSize(schema)

  function encode (args, buffer, start, end) {
    var free = min
    if(isNaN(free)) throw new Error('min size was nan')
    for(var i = 0; i < args.length; i++) {
      var field = schema[i]
      console.log(i, start, free)
      free += encodeField(field, args[i], buffer, start, free)
      if(isNaN(free)) throw new Error('free was nan after field:'+i)
    }
  }

  function decode (buffer, start, end) {
    var a = new Array(schema.length)
    for(var i = 0; i < schema.length; i++)
      a[i] = decodeField(schema[i], buffer, start)
    return a
  }

  function encodingLength (value) {
    var v_size = 0
    for(var i = 0; i < schema.length; i++) {
      var field = schema[i]
      if(field.pointed)
        v_size += field.pointed.encodingLength(value[i])
    }
    return min + v_size
  }

  return {
    encode, decode, encodingLength//, encodedLength
  }
}

//but what about an array?
//that's surely a special case.
//it's a variable size, with a single fixed size direct value type.
//then lots of those.
//but they could be pointers. if so, the natural woy to encode that would be
//array.direct -> array, big enough for every item.
//if they array type is direct, write the items into the array.
//if the array type is pointed, write the items to the end and pointers into the array.

//should the array length include all the items?
//leaning towards... No, because then can have compacted objects with pointer reuse.
//also, then you know where the array ends, so the element count in the array.

module.exports = {
  Field, codex, ObjectCodec, getMinimumSize, LengthDelimited
}