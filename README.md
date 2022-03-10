# ipb

in-place-binary format.
This is a data encoding format inspired by captnproto, but less complex.
Captnproto always sounded good, but reading the docs trying to understand
how it works always just made me more confused. I would start reading and
be bombarded with too many clever ideas like segments and XOR defaults.
It's too complex.

I want something efficient, but also simple.

Like captnproto we rely on a schema, and support in-place reads. The format is designed to be very fast
to extract a value, so that it is not necessary to parse and copy into a another data structure.
Instead, you can just quickly jump to the place where the data is and read exactly that value.

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

### ObjectCodec(schema)

`schema` is an array with an optional LengthField
then any number of pointed or direct fields [LengthField?, (DirectField|PointedField)*]

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
