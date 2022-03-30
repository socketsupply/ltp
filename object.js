'use strict'
var {getMinimumSize, assertNonOverlapping, encodeField, decodeField, isFixedSize} = require('./utils')

function ObjectCodec(schema) {
  assertNonOverlapping(schema)
  var min = getMinimumSize(schema)

  var fields = 0, fixed_fields = 0, variable_fields = 0, variable_field, length_field
  for(var i in schema) {
    fields ++
    if(!schema[i].pointed) { fixed_fields ++ }
    else {
      variable_fields ++;
      //if there is exactly one variable field, remember it. (but unset if 2 vfields)
      variable_field = variable_field === undefined ? schema[i] : null
    }
    //currently, length is required to be the first field
    //but there are also other types planned like checksum, so maybe relax this...
    if(schema[i].isLength)
      length_field = schema[i]
  }

  function encode (obj, buffer=Buffer.alloc(encodingLength(obj)), start=0, end=buffer.length) {
    var free = min
    if(isNaN(free)) throw new Error('min size was nan')
    for(var i = 0; i < schema.length; i++) {
      var field = schema[i]
      if(!field.isLength) {
        var value = obj[field.name]
        console.log(obj, value, field.name)
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
    return buffer
  }

  function decode (buffer, start=0, end=buffer.length) {
    end = Math.min(end, buffer.length)
    var a = {} //new Array(schema.length)

    for(var i = 0; i < schema.length; i++) {
      var field = schema[i]
      var value = a[field.name] = decodeField(field.position, field.direct, field.pointed, buffer, start, end, field.allow_zero)

      //remember the bytes, if length is included
      if(field.isLength) {
        decode.bytes = value
        var _end = start + value
        if(_end > end) throw new Error('length field out of bounds')
        //but a smaller value for end is acceptable.
        end = _end
      } else if(!length_field && variable_fields == 1 && field == variable_field) {
        decode.bytes = min + field.pointed.decode.bytes
      }
    }

    //calculating the total bytes decoded is a bit tricky because it's actually possible,
    //with relative pointers, that the bytes are not contigious.
    //for example, it's possible that nested objects share references to poinded values.
    //in cases where you actually need this, a length field should be included.

    if(variable_fields === 0) decode.bytes = min

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
      console.log('deref', start, position, relp)
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

  function encodedLength (buffer, start, end=buffer.length) {
    console.log('encodedLength', variable_fields, length_field)
    if(variable_fields === 0) return min
    else if(length_field) return decodeField(length_field.position, length_field.direct, null, buffer, start, end)
    else if(variable_fields === 1 && variable_field.direct == null) {
      return min + variable_field.pointed.encodedLength(buffer, start+variable_field.position)
    }
    else {
      //without an explicit length field, check which pointed field
      var max = min
      var max_f = null
      for(var i = 0; i < schema.length; i++) {
        var field = schema[i]
        if(field.pointed) {
          var ptr = dereference(buffer, start, i)
          var len = field.pointed.encodedLength(buffer, ptr)
          console.log('field', i, field.position, ptr+len - start)
          var field_end = ptr + len
          if(max < (field_end-start)) {
            max = field_end-start
            max_f = i
          }
        }
      }
      return max
    }
  }

  //compact takes an object that maybe has padding or points to far away objects
  //(this might happen because fields have been updated to point to new values)
  function compact(buffer, start, _buffer, _start) {
    if(!_buffer) {
        var total = min
        for(var i = 0; i < schema.length; i++) {
          var field = schema[i]
          if(field.pointed) {
            total += field.pointed.encodedLength(buffer, dereference(buffer, start, i)) 
          }
        }
        _buffer = Buffer.alloc(total), _start = 0
      }
//      else
    var free = min
    for(var i = 0; i < schema.length; i++) {
      var field = schema[i]
      if(field.pointed) {
        var ptr = dereference(buffer, start, i)
        var len = field.pointed.encodedLength(buffer, ptr)
        buffer.copy(_buffer, free, ptr, ptr+len)
        field.direct.encode(free - field.position, _buffer, field.position+_start)
        free += len
      }
      else {
        field.direct.encode(field.direct.decode(buffer, start+field.position), _buffer, field.position)
      }
    }
    return _buffer
  }

  return {
    type:'object',
    encode, decode, dereference, reflect, encodingLength,//, encodedLength
    bytes: variable_fields === 0 ? min : null,
    encodedLength, compact
  }
}

module.exports = ObjectCodec