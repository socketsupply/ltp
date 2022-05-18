function Type(codec, pointer=codec.pointer) {
  return codec.type+(pointer?'*':'')
}
//TODO change to Cast(type(codec), expression)
function Cast (type, expression, _expression) {
  if(_expression) throw new Error('first arg must be type')
  if('string' !== typeof type) throw new Error('type must be string, was:'+JSON.stringify(type))
  return '('+type+')('+expression+')'
}
function Def (type, name, _name) {
  if(_name) throw new Error('first arg must be type')
  return type + ' ' + name
}
function Call(fun, args) {
  return fun + '(' + args.join(', ') + ')'
}
function Func (type, name, args, statements) {
  var last = statements.pop()
  return `${type} ${name} (${args.filter(Boolean).join(', ')}) {\n  ` +
      [...statements, (type!='void'?'return ': '')+ last].join(';\n  ')+';\n}\n'
}
function PtrAdd (...args) {
  return '(u8*)(' + args.join(' + ') + ')'
}
function PtrSub (...args) {
  return '(usize)(' + args.join(' - ') + ')'
}
function Assign(variable, value) {
  return variable + ' = ' + value
}

module.exports = {Type, Cast, Def, Var:Def, Call, Func, PtrAdd, PtrSub, Assign}