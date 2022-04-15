var path = require('path')
var ltp = require('./')

function generateObjectCodec (prefix, name, schema, map) {
  var s = ''
  var min = ltp.getMinimumSize(schema)
  if(isNaN(min)) throw new Error('expected integer for minimum size, got NaN')
  function decode(field, decoder) {
    return `${prefix}decode__${name}_${field.name}`
  }
  function encode(field, decoder) {
    return `${prefix}encode__${name}_${field.name}`
  }
  var args = [], ops = []

  schema.forEach(function (field) {

    if(field.pointed && 'array' === field.pointed.type) {
      //generate array access methods
      // decode_index__<schema>_<field>(buf, index)
      // decode_length__<schema>_<field>(buf)
      // for_each__<schema>_<field>(buf, each)
    }

    var {type, direct, pointed, position} = field
    var v_name = `v_${field.name}`
    if(direct && !pointed) {
      s += (`
${direct.type} ${decode(field)} (byte* buf) {
  return ltp_decode__${direct.type}((byte*)(buf+${position}));
}
`)
      s += (`
void ${encode(field)} (byte* buf, ${direct.type} ${v_name}) {
  ltp_encode__${direct.type}((byte*)(buf+${position}), ${v_name});
}
`)     

      args.push(`${direct.type} ${v_name}`)
      ops.push(`${encode(field)}(buf, v_${field.name})`)
    }

    else if(direct && pointed) {
      //returns a pointer to the field type 
      //decode_${name}_${field.name} function returns a pointer to the input type.
     s +=(`
${pointed.type}* ${decode(field)} (byte* buf) {
  return (${pointed.type}*)ltp_decode_relp__${direct.type}(buf+${field.position});
}
`)
      s += (`
size_t ${encode(field)} (byte* buf, int ${v_name}_length, ${pointed.type}* ${v_name}, byte* free) {
  ltp_encode_relp__${direct.type}(buf+${position}, free);
  return ltp_encode__${pointed.type}(free, ${v_name}_length, ${v_name});
}`)
      args.push(`int v_${field.name}__length, ${pointed.type}* v_${field.name}`)
      ops.push(`free += ${encode(field)}(buf, v_${field.name}__length, v_${field.name}, free)`)
    }
    else if(!direct && pointed) {

      args.push(`${field.pointed.type}* v_${field.name}`)
      ops.push(`free += ${encode(field)}(buf, v_${field.name}, free)`)

    }
    //note, this sort of encode function, must copy another type data in.
    //would be best to return the bytes used (or, new pointer to next free space)
    //abstract-encoding returns the buffer, enabling allocating the buffer but that's not a great usecase) 

/*
    if(pointed) {
        s == (`
  size_t ${encode(field)}_cstring (byte* buf, int {v_name}_length,  char* ${v_name}, byte* free) {
  u32 len = strlen(${v_name});
  ltp_encode__${pointed.type}(free, ${v_name}_length, ${v_name}, len);
  ltp_encode__relp__${direct.type}(buf+${field.positon}, free);
  return len + 1;
}
`)
    }
*/
  })


  //a single encode function to get the entire object
  s += `
size_t ${prefix}encode__${name} (byte* buf, ${args.join(', ')}) {
  byte* free = buf+${min};
  ${ops.map(e=>e+';').join('\n  ')}
  return (size_t)(free - buf); 
}`

  return s + '\n'
}

module.exports = function (schemas, prefix='') {
  var s = require('fs').readFileSync(path.join(__dirname, 'ltp.h'), 'utf8')
  for(var name in schemas)
    s += generateObjectCodec(prefix, name, schemas[name])
  return s
}