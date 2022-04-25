var LengthDelimited = require('./length-delimited')
var V = require('varstruct')

function BufferCodec () {
  function encode (value, buffer, start) {
    value.copy(buffer, start)
    return encode.bytes = value.length
  }
  function decode (buffer, start=0, _end=buffer.length) {
    var value = buffer.slice(start, _end)
    decode.bytes = value.length
    return value
  }
  return  {
    encode, decode,
    encodingLength: (value) => { return value.length }
  }
}

var codex = {
  u8: {
    type: 'u8',
    encode: (value, buffer, start) => {
      if(value > 0xff || value < 0) throw new Error('u8 value out of bounds')
      buffer[start] = value & 0xff
    },
    decode: (buffer, start) => buffer[start] & 0xff,
    bytes: 1,
  },
  u16: {
    type: 'u16',
    encode: (value, buffer, start=0) => { buffer.writeUint16LE(value, start) },
    decode: (buffer, start=0) => buffer.readUint16LE(start),
    bytes: 2,
  },
  u32: {
    type: 'u32',
    encode: (value, buffer, start=0) => { buffer.writeUint32LE(value, start) },
    decode: (buffer, start=0) => buffer.readUint32LE(start),
    bytes: 4,
  },
  f32: {
    type: 'f32',
    encode: (value, buffer, start=0) => { buffer.writeFloatLE(value, start) },
    decode: (buffer, start=0) => buffer.readFloatLE(start),
    bytes: 4,
  },
  f64: {
    type: 'f64',
    encode: (value, buffer, start=0) => { buffer.writeDoubleLE(value, start) },
    decode: (buffer, start=0) => buffer.readDoubleLE(start),
    bytes: 8,
  },
  u64: {
    type: 'u64',
    //node buffers provide writeBigInt64LE but it's not UInt, so have to wrap that.
    encode: (value, buffer, start) => {
      if('number' === typeof value)
        value = BigInt(value)
      if(value > 0xffff_ffff_ffff_ffff || value < 0)
        throw new Error('u64 out of bounds')
      if(value > 0x7fff_ffff_ffff_ffff)
        buffer.writeBigInt64LE(value*-1n, start)
      else
        buffer.writeBigInt64LE(value, start)
    },
    decode: (buffer, start) => {
      var value = buffer.readBigInt64LE(start)
      if(value < 0) return value * -1
      return value
    },
    bytes: 8
  },
  buffer: BufferCodec()
  //i8, i16, i32, i64 ...

}

var string = {
  type: 'string',
  encode: (value, buffer, start) => {
    var bytes = Buffer.byteLength(value)
    if('string' !== typeof value) throw new Error('expected a string, got:'+JSON.stringify(string))
    buffer.write(value, start, start+bytes)
    buffer[start+bytes+1] = 0
    string.encode.bytes = bytes+1
  },
  decode: (buffer, start, end) => {
    var terminal = end-1
    if(buffer[terminal] != 0)
      throw new Error('invalid string termination:' +buffer[terminal]+' (0x'+buffer[terminal].toString(16)+'), at:'+(terminal-start)) 
    var value = buffer.toString('utf8', start, terminal)
    string.decode.bytes = end - start
    return value
  },
  encodingLength: (value) => Buffer.byteLength(value, 'utf8') + 1
}

codex.string_u8 = LengthDelimited(0, codex.u8, string)
codex.string_u16 = LengthDelimited(0, codex.u16, string)
codex.string_u32 = LengthDelimited(0, codex.u32, string)
//codex.string_u64 = LengthDelimited(0x10, codex.64, string)

codex.buffer_u8  = LengthDelimited(0, codex.u8,  codex.buffer)
codex.buffer_u16 = LengthDelimited(0, codex.u16, codex.buffer)
codex.buffer_u32 = LengthDelimited(0, codex.u32, codex.buffer)

function FixedBuffer (bytes) {
  var c = V.Buffer(bytes)
  c.bytes = bytes
  return c
}

//common fixed buffer sizes
codex.fixed_4 = FixedBuffer(4) //ipv4
codex.fixed_16 = FixedBuffer(16) //ipv6
codex.fixed_20 = FixedBuffer(20) //sha1
codex.fixed_32 = FixedBuffer(32) //sha256
codex.fixed_64 = FixedBuffer(64) //sha3, ed25519 signature

for(var k in codex)
  codex[k].type = k

module.exports = codex
