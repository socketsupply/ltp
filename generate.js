var path = require('path')
console.log(require('fs').readFileSync(path.join(__dirname, 'ipd.h'), 'utf8'))

function generateObjectCodec (name, schema) {
  function decode(field, decoder) {
    return `decode__${name}_${field.name}`
  }
  schema.forEach(function (field) {

    if(field.pointed && 'array' === field.pointed.type) {
      //generate array access methods
      // decode_index__<schema>_<field>(buf, index)
      // decode_length__<schema>_<field>(buf)
      // for_each__<schema>_<field>(buf, each)
    }

    if(field.direct && !field.pointed)
      console.log(`${field.direct.type} ${decode(field)} (byte* buf) {\n  return decode__${field.direct.type}((byte*)(buf+${field.position})); \n}`)

    else if(field.direct && field.pointed)
      //returns a pointer to the field type
      console.log(`${field.pointed.type}* ${decode(field)} (byte* buf) { return (${field.pointed.type}*)decode_relp__${field.direct.type}(buf+${field.position}); }`)

    else if(!field.direct && field.pointed)
      console.log(`${field.pointed.type}* ${decode(field)} (byte* buf) { return (${field.pointed.type})(buf+${field.position}); }`)


  })
}

var schema = [
  {name: 'foo', position: 0, direct: {type: 'u8'}},
  {name: 'bar', position: 1, direct: {type: 'u32'}},
  {name: 'name', position: 5, direct: {type: 'u8'}, pointed: {type: 'string_u8'}},
  {name: 'list', position: 6, direct: {type: 'u8'}, pointed: {
    type: 'array_u8', length: {type: 'u8'}, direct: {type: 'u8'}, pointed: {type: 'string_u8'}
  }}
]

generateObjectCodec('basic', schema)