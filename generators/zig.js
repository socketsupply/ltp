var map = {
  string_u8: '[*:0] u8',
  string_u16: '[*:0] u8',
  string_u32: '[*:0] u8',

  buffer_u8: '[*] u8',
  buffer_u16: '[*] u8',
  buffer_u32: '[*] u8',

  fixed_4:  '*[4]u8',
  fixed_8:  '*[8]u8',
  fixed_16: '*[16]u8',
  fixed_20: '*[20]u8',
  fixed_32: '*[32]u8',
  fixed_64: '*[64]u8',

  array_u8: '[*]u8'
}

function Type(codec, pointer=codec.pointer) {
    if(map[codec.type])
      return (map[codec.type] || codec.type)
    if(pointer) return '[*]'+codec.type
    return codec.type
//  return (pointer?'*':'')+codec.type
}
//TODO change to Cast(type(codec), expression)
function Cast (type, expression, _expression) {
  if(_expression) throw new Error('first arg must be type')
  if('string' !== typeof type) throw new Error('type must be string, was:'+JSON.stringify(type))
  return '@ptrCast(*'+(map[type]||type)+',&'+expression+').*'
}
//define an arg
function Def (type, name, _name) {
  if(_name) throw new Error('first arg must be type')
  return name+': '+type
}
//define a var
function Var (type, name, _name) {
  if(_name) throw new Error('first arg must be type')
  return 'var '+name+': '+type
}
function Call(fun, args) {
  return fun + '(' + args.join(', ') + ')'
}
function Func (type, name, args, statements) {
  var last = statements.pop()
  return `pub export fn ${name} (${args.filter(Boolean).join(', ')}) ${type} {\n  ` +
      [...statements, (type!='void'?'return ': '')+ last].join(';\n  ')+';\n}\n'
}
function PtrAdd (...args) {
  var [first, ...rest] = args.filter(Boolean)
  return '(' + first + rest.map(e => e < 0 ? ' - '+Math.abs(e) : ' + '+e).join('') + ')'
}
function PtrSub (...args) {
  return '(' + args.filter(Boolean).map(e => `@ptrToInt(${e})`).join(' - ') + ')'
}
function Assign(variable, value) {
  return variable + ' = ' + value
}

module.exports = {Type, Cast, Def, Var, Call, Func, PtrAdd, PtrSub, Assign}