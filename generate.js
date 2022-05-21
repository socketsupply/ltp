var path = require('path')
var ltp = require('./')

function size(type) {
  return `sizeof(${type})`
}

function generateObjectCodec (prefix, name, schema, map, lang) {
  var {Type, Cast, Def, Var, Call, Func, PtrAdd, PtrSub, Assign, Add} = lang

  var ByteP = Type({type:'u8', pointer: true})
  var SizeT = Type({type:'usize'})

  var s = ''
  var min = ltp.getMinimumSize(schema)
  if(isNaN(min)) throw new Error('expected integer for minimum size, got NaN')
  function decode(field, decoder) {
    return `${prefix}decode__${name}_${field.name}`
  }
  function encode(field, decoder) {
    return `${prefix}encode__${name}_${field.name}`
  }
  function encoding_length(field) {
    return `ltp_encoding_length__${field.pointed.type}`
//    return `${prefix}encoding_length__${name}_${field.name}`
  }


  var args = [], ops_direct = [], ops_pointed = [], length_args = [], length_ops = []

  var def_freep = Def(ByteP, 'free')
  var def_bufp = Def(ByteP, 'buf')
  var free = 'free'
  var buf = 'buf'

  function decode_direct(field) {
    return Func(Type(field.direct), decode(field), [def_bufp], [
      Call(`ltp_decode__${field.direct.type}`, [PtrAdd(buf, field.position)])
    ])
  }
  function encode_direct(field, def = Def(Type(field.direct), 'v_'+field.name), value='v_'+field.name) {
    return Func('void', encode(field), [def_bufp, def], [
      Call(`ltp_encode__${field.direct.type}`, [
        PtrAdd(buf, field.position),
        value
      ])
    ])
  }

  function decode_relp (direct, position) {
    return Call(`ltp_decode_relp__${direct.type}`, [PtrAdd(buf, position)])
  }

  function encode_relp (direct, position, target='free') {
    return Call(`ltp_encode_relp__${direct.type}`, [PtrAdd('buf', position), target])
  }

  function _decode_pointed(field, target) {
    return Func(Type(field.pointed, true), decode(field), [def_bufp], [
//      target
      Cast(Type(field.pointed, true), target)
    ])
  }

  function decode_pointed(field) {
    return _decode_pointed(field, decode_relp(field.direct, field.position))
  }

  function encode_pointed(field) {
    var {pointed,direct, position} = field
    var v_name = 'v_'+field.name
    return Func(SizeT, encode(field), [
      def_bufp, Def(SizeT, `${v_name}_length`), Def(Type(pointed, true), v_name), def_freep
    ], [
      encode_relp(direct, position),
      Call('ltp_encode__'+pointed.type, [free, `${v_name}_length`, v_name])
    ])
  }

  function decode_fpvs (field) {
    return _decode_pointed(field, PtrAdd(buf, field.position) )
  }

  function encode_fpvs (field) {
    var {pointed,direct, position} = field
    var v_name = 'v_'+field.name
    var v_length = v_name+'__length'
    return Func(SizeT, encode(field), [
      def_bufp, Def(SizeT, v_length), Def(Type(pointed, true), v_name)//, def_freep
    ], [
      Call('ltp_encode__'+pointed.type, [
        PtrAdd(buf, field.position),
        v_length,
        v_name
      ])
    ])
  }

  schema.forEach(function (field) {
    var {direct, pointed, position} = field
    var v_name = `v_${field.name}`
    var v_length = v_name+'__length'
    if(pointed)
      if(!pointed.type) throw new Error('pointed codec must have type, was:'+JSON.stringify(field))
    if(direct)
      if(!direct.type) throw new Error('direct codec must have type, was:'+JSON.stringify(field))

    //Direct to Pointed - (variable size value)
    if(pointed) {
      if(direct && pointed) {
        //returns a pointer to the field type 
        //decode_${name}_${field.name} function returns a pointer to the input type.
        s +=(decode_pointed(field))
        s += encode_pointed(field)
        ops_pointed.push(
          Assign(free, PtrAdd(free, Call(encode(field), [buf, v_length, v_name, free]))) 
        )
     }

      // Pointed only (implicit pointer, A SINGLE fixed position variable sized value)
      else if(!direct && pointed) {
        //generate encode/decode
        s += decode_fpvs(field)
        s += encode_fpvs(field)
        ops_pointed.push(
          Assign(free, PtrAdd(free, Call(encode(field), [buf, v_length, v_name]))) 
        )
      }
      args.push(Def(SizeT, v_length))
      args.push(Def(Type(field.pointed, true), v_name))
      length_args.push(Def(SizeT, v_length))
      length_ops.push(Call(encoding_length(field), [v_length]))
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
        s += encode_direct(field, def_freep, Cast(Type(direct), PtrSub(free, PtrAdd(buf, field.offset|0)))) 
        //XXX if there is an offset we need to add it on to decode.
        ops_direct.push(Call(encode(field), [buf, free]))

      }
      else if(field.isType) {

        //encoding the type, does not take args, because the schema defines the value 
        s += encode_direct(field, '', field.typeValue)

        //type does not appear in the args
        ops_direct.push(Call(encode(field), [buf]))

      }
      else {
        s += (encode_direct(field))

        args.push(Def(Type(direct), v_name))
        ops_direct.push(Call(encode(field), [buf, v_name]))
      }

      s += decode_direct(field)
    }

  })

  //a single encode function to get the entire object
  if(args.length) {
    s += Func(SizeT, `${prefix}encode__${name}`, [def_bufp, ...args], [
      Assign(Var(ByteP, free), PtrAdd(buf, min)),
      ...ops_pointed,
      ...ops_direct,
      PtrSub(free, buf)
    ])
  }
  s += Func(SizeT, `${prefix}encoding_length__${name}`, length_args, [
    Add(min, ...length_ops)
  ])

  return s + '\n'
}

module.exports = function (schemas, prefix='', includeHeader=true, lang) {
  var langs = {c:require('./generators/c'), zig:require('./generators/zig')}

  var funs = langs[lang]
  if(!funs) throw new Error('supported languages:'+Object.keys(langs)+', got:'+lang)
  var s = includeHeader ? require('fs').readFileSync(path.join(__dirname, 'headers', 'ltp.'+lang), 'utf8') : ''
  for(var name in schemas)
    s += generateObjectCodec(prefix, name, schemas[name], null, funs)
  return s
}