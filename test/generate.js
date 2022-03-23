var schema = {
  basic: [
    {name: 'foo', position: 0, direct: {type: 'u8'}},
    {name: 'bar', position: 1, direct: {type: 'u32'}},
    {name: 'name', position: 5, direct: {type: 'u8'}, pointed: {type: 'string_u8'}},
    {name: 'list', position: 6, direct: {type: 'u8'}, pointed: {
      type: 'array_u8', length: {type: 'u8'}, direct: {type: 'u8'}, pointed: {type: 'string_u8'}
    }}
  ]
}

console.log(require('../generate')(schema))