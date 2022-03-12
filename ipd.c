typedef unsigned char          u8;
typedef unsigned short int     u16;
typedef unsigned int           u32;
typedef unsigned long long int u64;

typedef char          i8;
typedef short int     i16;
typedef int           i32;
typedef long long int i64;

typedef u8 byte;

#pragma pack(1)
typedef struct {
  u8 length;
  byte content[0];
} string_u8;

#pragma pack(4)
typedef struct {
  u32 length;
  byte content[0];
} string_u32;

#pragma pack(4)
typedef struct {
  u8 length;
  u8 content[0];
} array_u8;

#pragma pack(4)
typedef struct {
  u32 length;
  u32 content[0];
} array_u32;


int decode__u8 (byte* buf) {
  return *(u8*)(buf);
}

int decode__u16 (byte* buf) {
  return *(u16*)(buf);
}

int decode__u32 (byte* buf) {
  return *(u32*)(buf);
}

int decode__u64 (byte* buf) {
  return *(u64*)(buf);
}

int decode_string_length__u32 (byte* buf) {
  return decode__u32(buf);
}
byte* decode_string__u32 (byte* buf) {
  return (byte*)(buf + sizeof(u32));
}

int decode_string_length__u8 (byte* buf) {
  return decode__u8(buf);
}
byte* decode_string__u8 (byte* buf) {
  return (byte*)(buf + sizeof(u8));
}

byte* decode_relp__u8 (byte* buf) {
  u8 v = decode__u8(buf);
  return (byte *)(v ? buf + v : 0);
}
byte* decode_relp__u32 (byte* buf) {
  u32 v = decode__u8(buf);
  return (byte *)(v ? buf + v : 0);
}

byte* decode_relp(byte* buf, int relp_value) {
  return (byte*)(buf+relp_value);
}

//for each is just a loop so using break/return inside gives you find
#define for_each(aryp, v, decode_value, end, each) { \
  byte* end = (byte*)(ary_p + decode__u32(ary_p, end)) \
  for(byte* p = (byte*)(ary_p + sizeof(u32)); p < end; p += sizeof(u32)) { \
    v = decode_value(p, end) \
    each \
  } \
}

//todo: sort (can do a quicksort in-place, changing only the relpointers)
//todo: binary search (only if the array is sorted)


/*
  generate_decode(schema)
  -> <type> decode_field__name(buf*) =>
    for each field name:

  decode_field__<schema> (buf*, field, end)
    if(field == N)
      decode__<type>(buf+<position>, end)
    for each field


  C macros can't be varargs, but cannot do recursion.
  so drill like in JS is not possible.
  so access in C would need:
    macro per field name.
  decode__<schema>_<field>(buf*)
  if it returns an array, 
  decode_array(buf*, index)

  to drill

  decode_sfoo_fbar(decode__sbaz_fqux(buf))

  //hmm, so far in anarchy the deepest object
  //is a field which is an array of strings
  //could easily have ls[0]
*/


u8 decode__basic_foo (byte* buf) {
  return decode__u8((byte*)(buf+0)); 
}
u32 decode__basic_bar (byte* buf) {
  return decode__u32((byte*)(buf+1)); 
}
string_u8* decode__basic_name (byte* buf) { return (string_u8*)decode_relp__u8(buf+5); }
array_u8* decode__basic_list (byte* buf) { return (array_u8*)decode_relp__u8(buf+6); }
