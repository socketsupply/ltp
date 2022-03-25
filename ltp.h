typedef unsigned char          u8;
typedef unsigned short int     u16;
typedef unsigned int           u32;
typedef unsigned long long int u64;

typedef char          i8;
typedef short int     i16;
typedef int           i32;
typedef long long int i64;

typedef u8 byte;
///*
typedef byte string_u8;
typedef byte string_u32;
typedef byte array_u8;
typedef byte array_u32;
//*/

/*
//I tried to make some functions nicer
//using structs, and field access
//but it didn't work except for the first field.
//I suppose something to do with alignment?
//I'm forming the opinion that C is actually not a very good language.
// leaky abstractions and too much sugar
// it's low level but not very explicit



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
//*/

#define encode_decode_int(INT_TYPE) \
  int decode__##INT_TYPE (byte* buf) { return (int)*(INT_TYPE*)(buf); } \
  void encode__##INT_TYPE (byte* buf, INT_TYPE val) { *(INT_TYPE*)buf = val; }

#define encode_decode_relp(INT_TYPE) \
  int decode_relp__##INT_TYPE (byte* buf) { \
    INT_TYPE v = decode__##INT_TYPE(buf); \
    return v == 0 ? 0 : (byte*)(buf + v) ; \
  } \
  void encode_relp__##INT_TYPE (byte* buf, byte *val) { \
    *(INT_TYPE*)buf = (INT_TYPE)(val - buf); \
   }

encode_decode_int(u8)
encode_decode_int(u16)
encode_decode_int(u32)
encode_decode_int(u64)

encode_decode_int(i8)
encode_decode_int(i16)
encode_decode_int(i32)
encode_decode_int(i64)

encode_decode_relp(u8)
encode_decode_relp(u16)
encode_decode_relp(u32)
encode_decode_relp(u64)
//do we want signed relative pointers?
//it's needed to have cyclic objects.


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

/*
byte* decode_relp__u8 (byte* buf) {
  u8 v = decode__u8(buf);
  return (byte *)(v ? buf + v : 0);
}
byte* decode_relp__u32 (byte* buf) {
  u32 v = decode__u8(buf);
  return (byte *)(v ? buf + v : 0);
}
*/

/*
//byte* decode_relp(byte* buf, int relp_value) {
//  return (byte*)(buf+relp_value);
//}
*/
int decode_array_length__u8(byte* buf) {
  return decode__u8(buf) / sizeof(u8);
}


byte* decode_array_index__u8(byte* buf, int index) {
  int length = decode__u8(buf);
  if(length - sizeof(u8) < index*sizeof(u8)) //out of bounds
    return 0;
  return decode_relp__u8((byte*)(buf+sizeof(u8)+sizeof(u8)*index));
}

typedef int (*equality_test)(byte* a, byte* b);

int equals__string_u8 (string_u8* a, string_u8* b) {
  //check if the same string painter
  if(a == b) return 1;
///*
  int length_a = decode__u8(a);
  int length_b = decode__u8(b);
  if(length_a != length_b) return 0;
  for(int i = 0; i < length_a; i++) {
//*/
/*
  if(a->length != b->length) return 0;
  for(int i = 0; i < a->length; i++) {
//*/
//    if(decode__u8(a->content[i]) != decode__u8(b->content[i]))
    if(decode__u8(a+i+sizeof(u8)) != decode__u8(b+i+sizeof(u8)))
      return 0;
  }
  return 1;
}

int equals__addr (byte* a, byte* b) {
  return a == b ? 1 : 0;
}

//for each is just a loop so using break/return inside gives you find
#define for_each(ary_p, i, v, decode, each) { \
  byte* end = (byte*)(ary_p + decode__u8(ary_p) + sizeof(u8)); \
  for(byte* p = ary_p + sizeof(u8); p < end; p += sizeof(u8)) { \
    v = decode(p); \
    each ; i++; \
  } \
};

int array_index_of__u8(byte* ary, byte* target, equality_test fn ) {
  int i = 0; byte* v;
  for_each(ary, i, v, decode_relp__u8, if(equals__string_u8(v, target)) return i;);
}

int array_index_of__string_u8(byte* ary, byte* target) {
  return array_index_of__u8(ary, target, equals__addr);
}

// ----------------- ENCODE ----

//todo: sort (can do a quicksort in-place, changing only the relpointers)
//todo: binary search (only if the array is sorted)
