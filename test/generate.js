var schema = {
  basic: [
    {name: 'foo', position: 0, direct: {type: 'u8'}},
    {name: 'bar', position: 1, direct: {type: 'u32'}},
    {name: 'name', position: 5, direct: {type: 'u8'}, pointed: {type: 'string_u8'}},
    {name: 'list', position: 6, direct: {type: 'u8'}, pointed: {
      type: 'array_u8', length: {type: 'u8'}, direct: {type: 'u8'}, pointed: {type: 'string_u8'}
    }}
  ],
  simpler: [
    {name: 'foo', position: 0, direct: {type: 'u8'}},
    {name: 'bar', position: 1, direct: {type: 'u32'}},
    {name: 'name', position: 5, direct: {type: 'u32'}, pointed: {type: 'string_u8'}}
  ],
  bigName: [
    {name: 'name', position: 5, direct: {type: 'u32'}, pointed: {type: 'string_u32'}}
  ],
  
  fixedbuf: [
    //note: Fied position variable sized field
    {name: 'text', position: 96, /*direct: {type: 'u8'}, */pointed: {type: 'string_u16'}},
    {name: 'hash', position: 64, direct: {type: 'fixed_32', pointer: true}},
    {name: 'signature', position: 0, direct: {type: 'fixed_64', pointer: true}}
  ]
  

}

console.log(require('../generate')(schema))