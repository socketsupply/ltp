var LengthDelimited = require('./length-delimited')

var codex = {
  u8: {
    encode: (value, buffer, start) => { buffer[start] = value & 0xff },
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
//    encode (value, buffer, start) => { buffer.writeUint32LE(value, start),
//    decode: (buffer, start) => buffer.readUint32LE(start),
    bytes: 8
  }
  //i8, i16, i32, i64 ...
  
}

var string = {
  encode: (value, buffer, start) => {
    var bytes = Buffer.byteLength(value)
    console.log(value, buffer, start, bytes)
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