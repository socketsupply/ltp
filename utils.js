var codex = require('./codex')

function isFixedSize(codec) {
  return 'number' === typeof codec.bytes && !isNaN(codec.bytes)
}

function assertFixedSize(codec) {
  if(!codec) throw new Error('expected a fixed size codec, got:'+codec)
  if(!isFixedSize(codec)) throw new Error('codec must be fixed size')
  return codec
}

//create a codec that is always the same (and uses zero bytes)
function Constant(v) {
  function encode (_v) { if(_v != v) throw new Error('expected constant value:'+v+', got:'+_v)}
  function decode () { return v }
  encode.bytes = decode.bytes = 0
  return {
    bytes: 0, encode, decode,
    encodingLength: ()=>0
  }
}


function isNonOverlapping (schema, assert=false) {
  for(var i = 0; i < schema.length; i++) {
    for(var j = i+1; j < schema.length; j++) {
      var fa = schema[i]
      var fb = schema[j]
      //check for overlap
      if(fb.direct && fa.direct)
      if(fa.position < fb.position + fb.direct.bytes && fa.position + fa.direct.bytes > fb.position) {
        if(assert) throw new Error('fields:'+fa.name +' & '+fb.name+' are overlapping')
        return false
      }
    }
  }
  return true
}

function assertNonOverlapping (schema) {
  isNonOverlapping(schema, true)
}


function PointedField (name, position, direct, pointed, isNullable=true) {
  return Field(name, position, direct, pointed, isNullable)
}

function Field (name, position, direct, pointed, isNullable=true, allowVariable = false) {
  if(!allowVariable) assertFixedSize(direct)
  if(!(position >= 0)) throw new Error('position must be >= 0, was:'+position)
  if(!Number.isInteger(position)) throw new Error('position must be integer, was:'+position)
  return {
    name, position, direct, pointed, isNullable, allowVariable : allowVariable 
  }
}

function TypeField(name, position, direct, typeValue, typeName) {
  return {
    name, position, direct, isType: true, typeValue, typeName
  }
}

function DirectField (name, position, direct) {
  return Field(name, position, direct, null, false)
}

function LengthField (name, position, direct, offset=0) {
  assertFixedSize(direct)
//  console.log("LengthField", {name, position, direct, isLength: true})
//  if(position !== 0) throw new Error('length position must be zero')
  return {
    name, position, direct, isLength: true, offset
  }
}


//because the schema could use padding, find the max position + size of that field.
//because of things like bit packed booleans that might overlap with larger numbers
//for example, an u64 with a boolean packed into the upper bits (which are at the end, in little endian)

//note, a single variable sized direct field is allowed,
//because it always starts at the same position.

var sizes = {
  u8: 1, u16: 2, u32: 4, u64:8,
  i8: 1, i16: 2, i32: 4, i64:8,

  f32: 4, f64: 8,

  fixed_16: 16,
  fixed_20: 20,
  fixed_32: 32,
  fixed_64: 64,
}

function sizeOf(codec) {
  if('number' === typeof codec.bytes)
    return codec.bytes
  if('string' === typeof codec.type && sizes[codec.type])
    return sizes[codec.type]
  throw new Error('codec must be fixed size')
}

function getMinimumSize(schema) {
  if(!schema.length) return 0 //or should an empty schema be a throw?
  var size = 0, fpvs = null
  for(var i = 0; i < schema.length; i++) {
    var field = schema[i]
    if(field.direct)
      size = Math.max(size, field.position + sizeOf(field.direct))
    else
      fpvs = field
  }
  if(fpvs && fpvs.position != size) {
    throw new Error('fpvs must be in last position') 
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
  direct && assertFixedSize(direct)
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
  else if(pointed && !direct) {
    pointed.encode(value, buffer, start + position)
    return pointed.encode.bytes
  }
  else 
    throw new Error('invalid field, must be direct or pointed & direct')
}

function decodeField (position, direct, pointed, buffer, start, end=buffer.length, allow_zero=false) {
//  if(!direct)
//    throw new Error('field must have direct codec')
  var test = direct && start + position + direct.bytes > end
  if(test) {
//    console.log('lo???g', {direct, start, position, end});
  //  console.log()
    //TODO XXX end is not big enough to contain: start + position + direct.bytes 
    throw new Error('direct value out of bounds? :'+test+JSON.stringify({direct, start, position, end, test}))
  }

  if(direct && !pointed)
    return direct.decode(buffer, start + position)
  else if (pointed && direct) {
    var rel = direct.decode(buffer, start + position)
    if(start + position + rel >= end)
      throw new Error('relative pointer out of bounds')
    return rel === 0 && !allow_zero ? null : pointed.decode(buffer, start + position + rel, end)
  }
  else if (pointed && !direct) {
    return pointed.decode(buffer, start + position, end)
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
      ptr = codex[i].dereference(buffer, ptr, index)
      //check for null pointers.
      if(ptr === -1) return null
    }
    return codec.decode(buffer, ptr)
  }
}

module.exports = {
  isNonOverlapping, assertNonOverlapping, isFixedSize, assertFixedSize, drill,
  assertFixedSize, encodeField, decodeField, getMinimumSize, Field, DirectField, PointedField, LengthField, TypeField,
  Constant
}