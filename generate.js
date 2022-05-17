var path = require('path')
var ltp = require('./')

var sizes = {


}

function size(type) {
  return `sizeof(${type})`
}

function Type(codec, pointer=codec.pointer) {
  return codec.type+(pointer?'*':'')
}
//TODO change to Cast(type(codec), expression)
function Cast (_type, isPointer, expression) {
  if('string' !== typeof _type) throw new Error('type must be string, was:'+JSON.stringify(_type))
  return '('+Type({type:_type, pointer: isPointer})+')'+expression
}
function Def (codec, name, pointer=codec.pointer) {
  return Type(codec, pointer) + ' ' + name
}
function Call(fun, args) {
  return fun + '(' + args.join(', ') + ')'
}
function Func (type, name, args, statements) {
  var last = statements.pop()
  return `${type} ${name} (${args.filter(Boolean).join(', ')}) {\n` +
      [statements, (type!='void'?'return ': '')+ last, ''].join(';\n') + '\n}'
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

  function decode_direct(field) {
    return Func(Type(field.direct), decode(field), [def_bufp], [
      Call(`ltp_decode__${field.direct.type}`, [`buf+${field.position}`])
    ])
  }
  function encode_direct(field, def = Type(field.direct)+' v_'+field.name, value='v_'+field.name) {
    return Func('void', encode(field), [def_bufp, def], [
      Call(`ltp_encode__${field.direct.type}`, [
        Cast('byte', true, `buf+${field.position}`),
        value
      ])
    ])
    return `
    void ${encode(field)} (byte* buf ${def ? ', '+def : def}) {
      ltp_encode__${field.direct.type}((byte*)(buf+${field.position}), ${value});
    }
    `
  }

  function decode_relp (direct, position) {
    return Call(`ltp_decode_relp__${direct.type}`, [`buf+${position}`])
  }

  function encode_relp (direct, position, target='free') {
    return Call(`ltp_encode_relp__${direct.type}`, [`buf+${position}`, target])
  }

  function _decode_pointed(field, target) {
    return `
    ${Type(field.pointed, true)} ${decode(field)} (byte* buf) {
      return ${Cast(field.pointed.type, true, target)} ;
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
  ${encode_relp(direct, position)};
  return ltp_encode__${pointed.type}(free, ${v_name}_length, ${v_name});
}`
  }

  function decode_fpvs (field) {
    return _decode_pointed(field, '(buf+'+field.position+')' )
  }

  var def_freep = Def({type:'byte', pointer: true}, 'free')
  var def_bufp = Def({type:'byte', pointer: true}, 'buf')

  function encode_fpvs (field) {
    var {pointed,direct, position} = field
    var v_name = 'v_'+field.name
    return `
    size_t ${encode(field)} (byte* buf, int ${v_name}_length, ${pointed.type}* ${v_name}, byte* free) {
      return ltp_encode__${pointed.type}((byte*)(buf+${field.position}), ${v_name}_length, ${v_name});
    }`
  }

  schema.forEach(function (field) {
    var {direct, pointed, position} = field
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
      args.push(Def({type:'u32'}, v_name+'__length', false))
      args.push(Def(field.pointed, v_name, true))
      ops_pointed.push(`free += ${encode(field)}(buf, ${v_name}__length, ${v_name}, free)`)
    }

    // Pointed only (implicit pointer, A SINGLE fixed position variable sized value)
    else if(!direct && pointed) {
      //generate encode/decode
      s += decode_fpvs(field)
      s += encode_fpvs(field)

      args.push(Def({type:'u32'}, v_name+'__length', false))
      args.push(Def(field.pointed, v_name, true))
      ops_pointed.push(`free += ${encode(field)}(buf, ${v_name}__length, ${v_name}, free)`)
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
        s += encode_direct(field, def_freep, Cast(direct.type, false, `(free-buf-${field.offset|0})`)) 
        s += decode_direct(field)

        ops_direct.push(Call(encode(field), ['buf', 'free']))

      }
      else if(field.isType) {

        //encoding the type, does not take args, because the schema defines the value 
        s += encode_direct(field, '', field.typeValue)
        s += decode_direct(field)

        //type does not appear in the args
        ops_direct.push(Call(encode(field), ['buf']))

      }
      else {
        s += decode_direct(field)
        s += (encode_direct(field))     

        args.push(Def(direct, v_name))
        ops_direct.push(Call(encode(field), ['buf', v_name]))
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