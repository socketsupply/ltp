
var {isArray} = Array
//en/decode a collection of types,
//every type must have a type field in the same place
//and a length field in the same place.
function getType(schema) {
  for(var i = 0; i < schema.length; i++)
    if(schema[i].isType)
      return i
  return -1
}

module.exports = function (codex) {
  //verify that every item has type/length

  if(!isArray(codex)) {
    var obj = codex
    codex = []
    for(var k in obj)
      codex.push(obj[k])
  } 
  var map = {}, nameMap = {}
  var type_position
  var type_field
  var type_field = codex[0].schema[getType(codex[0].schema)]
  map[type_field.typeName] = map[type_field.typeValue] = codex[0]
  nameMap[type_field.typeValue] = type_field.typeName
    
  for(var i = 1; i < codex.length; i++) {
    var codec = codex[i]
    var _type_field = codec.schema[getType(codec.schema)]
    if(!_type_field) throw new Error('codec:'+i+', is missing a type field')
      if(type_field.position !== _type_field.position)
        throw new Error('codec:'+i+', has type field in wrong position')
      if(type_field.direct.type !== _type_field.direct.type)
        throw new Error('codec:'+i+', has different type field')
    map[_type_field.typeName] = map[_type_field.typeValue] = codec
    nameMap[_type_field.typeValue] = _type_field.typeName
  }

  function decodeType(buffer, start, end) {
    return type_field.direct.decode(buffer, start + type_field.position, end)
  }

  return {
    type: 'any2',
    schema: codex,
    encode: function (value, buffer, start, end) {
      var codec = map[value[type_field.name]]
      return codec.encode(value, buffer, start, end)
    },
    decodeType,
    decodeTypeName: function (buffer, start, end) {
      var type = decodeType(buffer, start, end)
      return nameMap[type]
    },
    decode: function (buffer, start=0, end=buffer.length) {
      var tvalue = decodeType(buffer, start, end)
      var codec = map[tvalue]
      if(!codec) return null
      var obj = codec.decode(buffer, start, end) 
      obj[type_field.name] = nameMap[tvalue]
      return obj
    },
    encodingLength: function (value, buffer, start, end) {
      var codec = map[value[type_field.name]]
      return codec.encodingLength(value, buffer, start, end)
    },
    encodedLength: function (buffer, start, end) {
      var tvalue = decodeType(buffer, start, end)
      var codec = map[tvalue]
      return codec.encodedLength(buffer, start, end)
    },
  }
}