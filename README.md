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

Variable sized fields are encoded with a relative pointer in the fixed size
section - like primitive values, this is always in the same position.

```
00 00 00 00 //32 byte integer
04 00 00 00 --, //pointer to subsequent string
---           | //end of fixed section
05 00 00 00 <-` //length of a string
68 65 6c 6c 6f
```

The value of the relative pointer is the number of bytes from the pointer's position
to where the data value is. This is always after the fixed size values.
The advantage of a relative pointer is that the relative pointer has the same meaning
in different positions. an encoded object with relative pointers can be embedded inside
another and the pointers remain valid.


## example

suppose we are defining a simple object with 3 fields, count, name, time.

```
{
  i32 count
  string name
  double time
}
```

we could encode into a buffer like this:
```
object_codec.encode({count, 27, name:"hello", time:ts}, buffer, 0)
```

here are the bytes we would get (formatted and commented for clarity)
(note, numbers in [little endian](https://en.wikipedia.org/wiki/Endianness) seem strange at first,
but have better hardware support and you'll get used to them quickly)
````
1b 00 00 00             //count: 27 in little endian
0c 00 00 00             //name: string starts 12 bytes after this position (0x0c)
01 12 ab 32 03 23 57 86 //time: double
05 00 00 00             //name.length is 5 bytes
68 65 6c 6c 6f          //ascii bytes of "hello"
```

reading the primitive values is just a single memory read.
reading the variable values is a read of the pointer, adding the value to the pointer's address,
then reading the length, then you know where the string starts and ends. The string can be copied
from memory, or used directly, if you are careful about the lifetimes of the string and the memory buffer
that the object is encoded into.


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

## types

### fixed size values

0: reserved, because this is initialized value.

integers: {i,u}{8,16,32,64} 8 integer types. 1-8

f32, f64 (two decimal types) 9,a

### fixed size, bitpacked values

boolean (1) 0x08 - 0x0f, lower 3 bits represent which bit the boolean is stored into.

0x10 - 1f ??? (4 bits spare)
0x20 - 3f ??? (5 bits spare)

tinyint: u{2-7} 3 bits for start position within byte, 3 bits for length.
         often compact formats pack small numbers within bytes, as used in this format!

        this field is encoded as: `0x40 | (bits & 0b111) << 3 | (start & 0b111)`

### variable sized

string, 0x4 | max_length

bytes 0x80 - 0xbf string type max length in bits of length field (bottom 6 bits are length - 1) max string length can be any power of 2 up to 2^64.

### object

if an object is fixed size, then it can be embedded directly
although it may be preferred to use relpointers instead, so that values can be reused.

an object is a relpointer and length.

## field

str name, u64 type, u32 length (bytes), u32 position, boolean is_pointer

pointers:
  u16 length_type, u32 max_length, u16 embed_type


## essential types

u8,u16,u32,u16,i8,i16,i32,i64
boolean
string
data
embed

pointerless, string, data, embed
poister size as 0, 8, 16, 32 bytes
array