var assert = require('assert')
var schema = 
  new Uint16Array([
    0, 1, // u8 at 0
    2, 2, // u16 at 4
    4, 3, // u32 at 4
  ])

// field

/*

*/

function Field () {
  return {
    position: int,
    type: int,
//    special: LENGTH | TYPE | CHECKSUM | ORDINARY,
    //note special 
    name: string

  }

}


var sizeOf = [, 1, 2, 4, 8, 4]
var isVariable = [false, false, false, false, false, true]

//simple, without packing
function positionsFromTypes(types) {
//  var positions = new Array(types.length)
  var max = 0
  return types.map(type => { var _max = max; max += sizeOf[type]; return _max })
  //return positions
}

function isFixedSize(types) {
  return types.every(t => !isVariable[t])
}

function getSize(schema) {
  var max = 0
  for(var i = 0; i < schema.length; i += 2)
    if(schema[max] < schema[i]) max = i
  return schema[max] + sizeOf[schema[max+1]]
}

function createObject (...types) {

  var positions = positionsFromTypes(types)
  var fixedSize = isFixedSize(types)
  console.log(positions, fixedSize)
  var schema = new Array(types.length*2)
  for(var i = 0; i < types.length; i++) {
    schema[i*2] = positions[i]
    schema[i*2+1] = types[i]
  }

  var size = getSize(schema)

  function encode (...args) {
    var free = getSize(schema)
    var buf = Buffer.alloc(fixedSize ? free : 1024)
    for(var i = 0; i < args.length; i++) {
      var value = args[i]
      var type = schema[(i*2)+1]
      var pos = schema[i*2]
      //u8
      if(type === 1) buf[pos] = value
      //u16
      if(type === 2) buf.writeUInt16LE(value, pos)
      //u32
      if(type === 3) buf.writeUInt32LE(value, pos)
      //u64
      if(type === 4) throw new Error('not implemented yet: u64')

      //u32 string
      if(type === 5) {
        var len = Buffer.byteLength(value)
        buf.writeUint32LE(free - pos, pos)

        buf.writeUint32LE(len, free)
        buf.write(value, free+4, 'utf8')
        free = free + 4 + len
      }
      //pointerless string
    }
    if(hasLength(schema)) {
      //should we require that the length should always be at the start? (position=0)
      //write the length.
       buf.writeUint32LE(free, getLengthPos(schema))
    }
  }
    
    //handle special types
    //length
    //type
    //checksum

    return buf
  }

  function decode (buf) {
    var out = new Array(schema.length / 2)
    for(var i = 0; i < schema.length; i += 2) {
      var type = schema[i+1]
      var pos = schema[i]
      var index = i/2
      out[index] = (
        type === 1 ? buf[pos]
      : type === 2 ? buf.readUInt16LE(pos)
      : type === 3 ? buf.readUInt32LE(pos)
      : type === 4 ? (()=> { throw new Error('not implemented yet: u64') })()
      : type === 5 ? (() => {
          var rp = buf.readUInt32LE(pos);
          var str = rp + pos;
          var len = buf.readUInt32LE(str);
          return buf.toString('utf8', str+4, str+len+4)
        })()
      : (()=> { throw new Error('unknown type:'+type) })()
      )
    }
    return out
  }

  if(isFixedSize) encode.bytes = decode.bytes = size

  function encodingLength (...value) {
    if(fixedSize) return size
    else return -1
  }

  return {
    encode,
    decode,
    encodingLength,
    bytes: fixedSize ? size : undefined
  }
}


var c = createObject(1, 2, 3, 5)
var e = [7, 1235, 1_000_000, 'hello world!']
var b = c.encode(...e)

console.log(b)
console.log(c.decode(b))

assert.deepEqual(c.decode(c.encode(...e)), e)
