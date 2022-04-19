var LengthDelimited = require('./length-delimited')
var V = require('varstruct')

var codex = {
  u8: {
    encode: (value, buffer, start) => {
      if(value > 0xff || value < 0) throw new Error('u8 value out of bounds')
      buffer[start] = value & 0xff
    },
    decode: (buffer, start) => buffer[start] & 0xff,
    bytes: 1,
  },
  u16: {
    encode: (value, buffer, start=0) => { buffer.writeUint16LE(value, start) },
    decode: (buffer, start=0) => buffer.readUint16LE(start),
    bytes: 2,
  },
  u32: {
    encode: (value, buffer, start=0) => { buffer.writeUint32LE(value, start) },
    decode: (buffer, start=0) => buffer.readUint32LE(start),
    bytes: 4,
  },
  u64: {
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
  buffer: {
    encode: (value, buffer, start) => { value.copy(buffer, start); this.encode.bytes = value.length },
    decode: (buffer, start, _end) => { value.copy(buffer, start); this.encode.bytes = value.length },
  }
  //i8, i16, i32, i64 ...

}

var string = {
  encode: (value, buffer, start) => {
    var bytes = Buffer.byteLength(value)
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

function FixedBuffer (bytes) {
  var c = V.Buffer(bytes)
  c.bytes = bytes
  return c
}

//common fixed buffer sizes
codex.fixed_16 = FixedBuffer(16) //ipv6
codex.fixed_20 = FixedBuffer(20) //sha1
codex.fixed_32 = FixedBuffer(32) //sha256
codex.fixed_64 = FixedBuffer(64) //sha3, ed25519 signature

module.exports = codex
