var path = require('path')

function generateObjectCodec (name, schema) {
  var s = ''
  function decode(field, decoder) {
    return `decode__${name}_${field.name}`
  }
  function encode(field, decoder) {
    return `encode__${name}_${field.name}`
  }
  var args = [], ops = []

  schema.forEach(function (field) {

    if(field.pointed && 'array' === field.pointed.type) {
      //generate array access methods
      // decode_index__<schema>_<field>(buf, index)
      // decode_length__<schema>_<field>(buf)
      // for_each__<schema>_<field>(buf, each)
    }

    var {type, direct, pointed, name, position} = field
    if(direct && !pointed) {
      s += (`${direct.type} ${decode(field)} (byte* buf) {\n  return decode__${direct.type}((byte*)(buf+${position})); \n}\n`)
      s += (`void ${encode(field)} (byte* buf, ${direct.type} v_${name}) {\n  encode__${direct.type}((byte*)(buf+${position}), v_${name}); \n}\n`)     

      args.push(`${direct.type} v_${field.name}`)
      ops.push(`${encode(field)}(buf, v_${field.name})`)
    }

    else if(direct && pointed) {
      //returns a pointer to the field type 
     s += (`${pointed.type}* ${decode(field)} (byte* buf) {\n  return (${pointed.type}*)decode_relp__${direct.type}(buf+${field.position}); \n}\n`)
      s += (`void ${encode(field)} (byte* buf, ${pointed.type}* v_${name}) {\n  encode_relp__${field.direct.type}(buf+${position}, v_${name});\n}\n`)

      args.push(`${field.pointed.type}* v_${name}`)
      ops.push(`${encode(field)}(buf, v_${name})`)

    }
    else if(!field.direct && field.pointed)
      s += (`${pointed.type}* ${decode(field)} (byte* buf) {\n  return (${pointed.type})(buf+${field.position}); \n}\n`)
  })

  s += `void encode__${name} (byte* buf, ${args.join(', ')}) {\n  ${ops.map(e=>e+';').join('\n  ')} \n}\n`

  return s + '\n'


}

module.exports = function (schemas) {
  var s = require('fs').readFileSync(path.join(__dirname, 'ltp.h'), 'utf8')
  for(var name in schemas)
    s += generateObjectCodec(name, schemas[name])
  return s
}