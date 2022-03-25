# ltp

high performance simple in-place encoding format.

High performance and simplicity usually go together.
We often think of high performance as "more power".
With, for example, a car, you can put in a larger engine and burn more fuel, faster.
But with software, that's wrong. To make software faster you can only take away unnecessary work.
Often, something designed for simplicity is quite fast, because simplicity must also avoid unnecessary work.
We also like simplicity because it makes it _faster to understand_.

A format such as json may appear simple, because it is so familiar.
But parsing json text into a data structure involves quite a lot of extra work.
One aspect of the work is examining each byte in the input, switching between states,
escaping characters, etc. Another significant aspect is transforming the flat bytes into a
data structure, (which means the garbage collector must get involved)
Often, we parse a json object, and then only access one or two fields.
If there are a lot of data moving through the system this parsing and data structure
building can be very significant. People say that the JSON parsing libraries built into your system
are well optimized, and are fast. They may well be fast compared to other JSON libraries,
but they still include a lot of uncessary work.

An in-place binary format takes a conceptually very different approach.
"in-place" means that the format is designed so that you can read out individual fields without needing
to a) examine every byte, and b) without needing to create a data structure.

## other in-place formats

Sadly, there are not many in-place formats available. This is why I need to both explain and design them.

### bipf

[bipf](https://github.com/ssbc/bipf) is another format I created earlier. `bipf` targets json style schemaless data, so it includes unnecessary work compared to `ltp`.

### capt'n'proto

Captnproto always sounded good, but reading the docs trying to understand
how it works always just made me more confused. I would start reading and
be bombarded with too many clever ideas like segments and XOR defaults.
I wanted something I could easily understand.

## the name: ltp

`ltp` can be pronounced like "litup" or LTP.
The joke was that it's "lieutenant proto", lieutenant being a lower rank than captain.

## fixed vs variable size fields

Your basic primitives: numbers, boolean, are always the same size.
These are always encoded at the start of an object, and in the same position.
So if the first field is a 32 bit integer, then that's the first 4 bytes.

Strings, buffers, and embedded objects (if they contain a variable sized object)
are variable sized.

An object with only fixed size fields are simple.

with the schema
```
{
  count i32
  b u8
  foo boolean
}
```
and values (`{count: 123, b: 64, foo: true}`)
```
7b 00 00 00 //4 bytes, little endian
40          // a single byte 0x40=64
01          // a single bit for the boolean
```

this object always takes 6 bytes no matter what it's field values are.

On the other hand, variable sized fields are encoded with a relative pointer in the fixed size
section - like primitive values, this is always in the same position.

using the schema

```
{
  count i32 //32 bit integer
  name string_u32 //string up to max u32 length
}
```

```
00 00 00 00 //32 byte integer
04 00 00 00 // --, pointer to subsequent string
---         //   | (end of fixed section)
05 00 00 00 // <-` length of a string
68 65 6c 6c 6f
```

The value of the relative pointer is the number of bytes from the pointer's position
to where the data value is. This is always after the fixed size values.
The advantage of a relative pointer like this is that it always has the same meaning
in different positions. An encoded object with relative pointers can be embedded inside
another and the pointers remain valid, this is very handy when transmitting objects
over the network, or embedding objects inside of other objects.

## schema data structure

to understand what sort of things ipb can represent, it's helpful to understand it's internal data structure.

### ObjectCodec([fields...]) => codec

`schema` is an array with an optional LengthField
then any number of pointed or direct fields [LengthField?, (DirectField|PointedField)*]

returns a `codec` which is based on [`abstract-encoding`](https://github.com/mafintosh/abstract-encoding) but has some extentions, such as a `bytes` property if it's fixed size, and `encodedLength` function.

#### codec.encode (value, buffer, start)

encode `value` into `buffer` at position `start`.
sets `codec.encode.bytes` to the number of bytes used.

#### codec.decode (buffer, start, end) => value

decode `value` from `buffer` at position `start`.
if anything goes outside of `end` while reading, then an exception will be thrown.
By default `end = buffer.length`.
When an ObjectCodec has a length field, or can otherwise determine the length,
it may contract the `end` value for any embedded fields.

This is a security feature. Without the `end` field,
it would be possible to have a record that on the outside would be small,
but in the inside claimed to be big, which could cause it to read out of bounds memory which could contain sensitive data, such as private keys.

#### codec.encodingLength(value) =>

return the bytes that will be needed to encode `value`

#### codec.bytes //fixed size objects only

If a codec is fixed size, it will have an integer `bytes` property defined.
Fixed size fields are very useful because they enable much faster reads.

#### codec.encodedLength(buffer, start, end)

return the length used by the record at start, _but do not decode it_.
Some times it's useful to know how long a record is without decoding it.
This allows you to for example, process records in a stream.

#### codec.dereference(buffer, start, field_index) => pointer

returns a pointer to where the field at `index` is encoded.
For direct fields, this returns the fixed offset of that field.
For variable size, pointed fields, this reads the relative pointer,
and returns the actual position of the value.

#### codec.reflect(field_index) => codec

returns the codec used for a specific field.
Use in combination with `dereference`

`codec.reflect(index).decode(buffer, codec.dereference(buffer, start, index))`




### fields

#### DirectField (name, position, value_codec)

create a field that stores a fixed size value in a fixed position.
`name` is a utf8 string for the field (used when decoding to a js/json object)
`position` is an integer, a fixed byte offset into an object.
`value_codec` is the encoding used for the value. (must be [abstract-encoding interface](https://github.com/mafintosh/abstract-encoding) and must be a _fixed size_)

#### PointedField (name, position, direct_codec, pointed_codec, isNullable=false)

a field that stores a fixed size pointer to a variable sized field
`name` and position are the same as `DirectField` but `direct_codec` is the an integer type used
to encode the relative pointer to the value. `pointed_codec` is the actual value,
usually this would be a length delimited variable size encoding.

if isNullable is true, null pointers are allowed, represented by a relpointer=0.

#### LengthField (name, position=0, length_codec)

A special case to embed the length of an object. position must be 0,
(that is, at the start of the object). When encoding an object,
the length used will be calculated and written to this position,
including the length used to write any pointed values.
If the input has a length value, it is ignored. When decoding an object,
the length read is returned in the name field.

#### FixedPositionVariableField (name, position, value_codec)

If you care about using space as efficiently as possible,
then you can save the space needed for the pointer as long as there is only one varible size field
and it's the last field. FixedPositionVariableSizeField cannot be nullable (but can encode an empty string)

### DirectArrayCodec (length_codec, value_codec)

create an array codec that stores fixed size values directly.
`length_codec` must be an unsigned integer type, that will express the maximum _byte length_
of the array.

`value_codec` is the codec used to encode the values, which must be fixed size.
the maximum number of items in the array will be the maximum value expressible by the length
codec, divided by the size of the `value_codec`.

because the value_codec is stored directly, DirectArrayCodec can not express null pointers,
only zero values.

### PointedArrayCodec (length_codec, direct_codec, pointed_codec, isNullable)

create an array codec that stores variable sized objects, indexed by fixed size relative pointers.
`length_codec` must be an unsigned integer type, that will express the maximum _byte length_
of the array. `direct_codec` must be a integer type. `pointed_codec` encodes the array value
and should be a variable size codec. The maximum number of elements is the maximum value expressible of `length_codec` divided by the size of `pointed_codec`

if isNullable is true, null pointers are allowed, represented by a relpointer=0.

## Any(type_codec, length_codec, codec_lookup) = require('ltp/any')

A codec for handling dynamic types. This is encoded with the `type`, then the `length` then the codec returned by
`codec_lookup(type)`. Returns a `{type, value}` object, where `value` is the embedded dynamic object.
`type_codec` and `length_codec` must both be fixed size.

## Any.AnyPointer(type_codec, length_codec, codec_lookup)

The same as above, but on decode, returns `{type, length, value}` but value is just a pointer to the start
of where the value is encoded. The end will be at `value + length`.

If you care about performance it maybe important to use in-place access.
Therefore it's recommended to use AnyPointer and then read specific fields of the returned
object.