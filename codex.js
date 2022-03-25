var LengthDelimited = require('./length-delimited')

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
    encode: (value, buffer, start) => { buffer.writeUint16LE(value, start) },
    decode: (buffer, start) => buffer.readUint16LE(start),
    bytes: 2,
  },
  u32: {
    encode: (value, buffer, start) => { buffer.writeUint32LE(value, start) },
    decode: (buffer, start) => buffer.readUint32LE(start),
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
    decode: (buffer, start, end) => { value.copy(buffer, start); this.encode.bytes = value.length },


  }
  //i8, i16, i32, i64 ...
  
}

var string = {
  encode: (value, buffer, start) => {
    var bytes = Buffer.byteLength(value)
    buffer.write(value, start, start+bytes)
    string.encode.bytes = bytes
  },
  decode: (buffer, start, end) => {
    var value = buffer.toString('utf8', start, end)
    string.decode.bytes = end - start
    return value
  },
  encodingLength: (value) => Buffer.byteLength(value, 'utf8')
}

codex.string_u8 = LengthDelimited(0x10, codex.u8, string)
codex.string_u16 = LengthDelimited(0x10, codex.u16, string)
codex.string_u32 = LengthDelimited(0x10, codex.u32, string)
//codex.string_u64 = LengthDelimited(0x10, codex.64, string)
module.exports = codex