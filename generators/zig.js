function Type(codec, pointer=codec.pointer) {
  return (pointer?'*':'')+codec.type
}
//TODO change to Cast(type(codec), expression)
function Cast (type, expression, _expression) {
  if(_expression) throw new Error('first arg must be type')
  if('string' !== typeof type) throw new Error('type must be string, was:'+JSON.stringify(type))
  return '('+type+')('+expression+')'
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
  return `pub fn ${name} (${args.filter(Boolean).join(', ')}) ${type} {\n  ` +
      [...statements, (type!='void'?'return ': '')+ last].join(';\n  ')+';\n}\n'
}
function Add (...args) {
  return '(' + args.join(' + ') + ')'
}
function Sub (...args) {
  return '(' + args.join(' - ') + ')'
}
function Assign(variable, value) {
  return variable + ' = ' + value
}

module.exports = {Type, Cast, Def, Var, Call, Func, Add, Sub, Assign}