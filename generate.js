var path = require('path')
var ltp = require('./')

var sizes = {


}

function size(type) {
  return `sizeof(${type})`
}

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
  var args = [], ops_direct = [], ops_pointed = []

  function cast (type, isPointer, expression) {
    return `(${type}${isPointer ? '*' : ''})${expression}`
  }

  function decode_direct(field) {
    return `
    ${field.direct.type} ${decode(field)} (byte* buf) {
      return ltp_decode__${field.direct.type}((byte*)(buf+${field.position}));
    }
    `
  }
  function encode_direct(field, value='v_'+field.name) {
    return `
    void ${encode(field)} (byte* buf, ${field.direct.type} ${value}) {
      ltp_encode__${field.direct.type}((byte*)(buf+${field.position}), ${value});
    }
    `
  }

  function decode_relp (direct, position) {
    return `ltp_decode_relp__${direct.type}(buf+${position})`
  }

  function encode_relp (direct, position, target='free') {
    return `ltp_encode_relp__${direct.type}(buf+${position}, ${target});`
  }

  function _decode_pointed(field, target) {
    return `
    ${field.pointed.type}* ${decode(field)} (byte* buf) {
      return ${cast(field.pointed.type, true, target)} ;
    }
    `
  }

  function decode_pointed(field) {
    return _decode_pointed(field, decode_relp(field.direct, field.position))
  }

  function encode_pointed(field) {
    var {pointed,direct, position} = field
    var v_name = 'v_'+field.name
    return `
size_t ${encode(field)} (byte* buf, int ${v_name}_length, ${pointed.type}* ${v_name}, byte* free) {
  ${encode_relp(direct, position)}
  return ltp_encode__${pointed.type}(free, ${v_name}_length, ${v_name});
}`
  }

  function decode_fpvs (field) {
    return _decode_pointed(field, '(buf+'+field.position+')' )
  }

  function encode_fpvs (field) {
    var {pointed,direct, position} = field
    var v_name = 'v_'+field.name
    return `
    size_t ${encode(field)} (byte* buf, int ${v_name}_length, ${pointed.type}* ${v_name}, byte* free) {
      return ltp_encode__${pointed.type}((byte*)(buf+${field.position}), ${v_name}_length, ${v_name});
    }`
  }

  schema.forEach(function (field) {
    var {type, direct, pointed, position} = field
    var v_name = `v_${field.name}`

    if(pointed)
      if(!pointed.type) throw new Error('pointed codec must have type, was:'+JSON.stringify(field))
    if(direct)
      if(!direct.type) throw new Error('direct codec must have type, was:'+JSON.stringify(field))

    //Direct to Pointed - (variable size value)
    if(direct && pointed) {
      //returns a pointer to the field type 
      //decode_${name}_${field.name} function returns a pointer to the input type.
      s +=(decode_pointed(field))
      s += encode_pointed(field)
      args.push(`int v_${field.name}__length, ${pointed.type}* ${v_name}`)
      ops_pointed.push(`free += ${encode(field)}(buf, ${v_name}__length, ${v_name}, free)`)
    }

    // Pointed only (implicit pointer, A SINGLE fixed position variable sized value)
    else if(!direct && pointed) {
      //generate encode/decode
      s += decode_fpvs(field)
      s += encode_fpvs(field)

      args.push(`int ${v_name}_length, ${field.pointed.type}* ${v_name}`)
      ops_pointed.push(`free += ${encode(field)}(buf, ${v_name}_length, ${v_name}, free)`)
    }
    //note, this sort of encode function, must copy another type data in.
    //would be best to return the bytes used (or, new pointer to next free space)
    //abstract-encoding returns the buffer, enabling allocating the buffer but that's not a great usecase) 


    if(field.pointed && 'array' === field.pointed.type) {
      //generate array access methods
      // decode_index__<schema>_<field>(buf, index)
      // decode_length__<schema>_<field>(buf)
      // for_each__<schema>_<field>(buf, each)
    }

    //Direct value (fixed size only)
    if(direct && !pointed) {
      //check if it's a direct field, but we are handling it as a pointer
      //for example, it's a fixed size array.
      if(field.isLength) {
            s += (`
      void ${encode(field)} (byte* buf, byte* free) {
        ltp_encode__${direct.type}((byte*)(buf+${position}), (${direct.type})(free-buf-${field.offset|0}));
      }
      `)     
        s += (`
  ${direct.type}* ${decode(field)} (byte* buf) {
    return ltp_decode__${direct.type}((byte*)(buf+${position}+${field.offset|0}));
  }
  `)

        ops_direct.push(`${encode(field)}(buf, free);`)

      }
      else if(field.isType) {

        //encoding the type, does not take args, because the schema defines the value
        s += (`
  void ${encode(field)} (byte* buf) {
    ltp_encode__${direct.type}((byte*)(buf+${position}), ${field.typeValue});
  }
  `)     

        s += (`
  ${direct.type}* ${decode(field)} (byte* buf) {
    return ltp_decode__${direct.type}((byte*)(buf+${position}));
  }
  `)

        //type does not appear in the args
        ops_direct.push(`${encode(field)}(buf)`)


      }
      else {
        if(direct.pointer) {

          s += (`
    ${direct.type}* ${decode(field)} (byte* buf) {
      return ltp_decode__${direct.type}((byte*)(buf+${position}));
    }
    `)

          s += (`
    void ${encode(field)} (byte* buf, ${direct.type}* ${v_name}) {
      ltp_encode__${direct.type}((byte*)(buf+${position}), ${v_name});
    }
    `)     

          args.push(`${direct.type}* ${v_name}`)

          ops_direct.push(`${encode(field)}(buf, v_${field.name})`)

        }
        else {

          s += decode_direct(field)

          s += (encode_direct(field))     

          args.push(`${direct.type} ${v_name}`)

          ops_direct.push(`${encode(field)}(buf, v_${field.name})`)

        }
      }
    }

  })


  //a single encode function to get the entire object
  if(args.length) {
    s += `
  size_t ${prefix}encode__${name} (byte* buf, ${args.join(', ')}) {
    byte* free = buf+${min};
    ${ops_pointed.map(e=>e+';').join('\n    ')}
    ${ops_direct.map(e=>e+';').join('\n    ')}
    return (size_t)(free - buf); 
  }`
  }

  return s + '\n'
}

module.exports = function (schemas, prefix='', includeHeader=true) {
  var s = includeHeader ? require('fs').readFileSync(path.join(__dirname, 'ltp.h'), 'utf8') : ''
  for(var name in schemas)
    s += generateObjectCodec(prefix, name, schemas[name])
  return s
}