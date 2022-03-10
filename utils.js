var codex = require('./codex')

function isFixedSize(codec) {
  return !isNaN(codec.bytes)
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

function Field (name, position, direct, pointed, isNullable=true, allow_zero) {
  assertFixedSize(direct)
  if(!(position >= 0)) throw new Error('position must be >= 0, was:'+position)
  if(!Number.isInteger(position)) throw new Error('position must be integer, was:'+position)
  return {
    name, position, direct, pointed, isNullable, allow_zero: allow_zero
  }
}

function DirectField (name, position, direct) {
  return Field(name, position, direct, null, false)
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
    console.log({position, pointed, direct, value, free, start})
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

function decodeField (position, direct, pointed, buffer, start, end=buffer.length, allow_zero=false) {
  if(!direct)
    throw new Error('field must have direct codec')

//  console.log('out of bounds?', start, position, direct.bytes, end)
  if(start + position + direct.bytes > end)
    throw new Error('direct value out of bounds')

  if(!pointed)
    return direct.decode(buffer, start + position)
  else if (pointed) {
    var rel = direct.decode(buffer, start + position)
    if(start + position + rel >= end)
      throw new Error('relative pointer out of bounds')
    return rel === 0 && !allow_zero ? null : pointed.decode(buffer, start + position + rel, end)
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
  isNonOverlapping, assertNonOverlapping, isFixedSize, assertFixedSize, drill,
  assertFixedSize, encodeField, decodeField, getMinimumSize, Field, DirectField, PointedField, LengthField,
  Constant
}