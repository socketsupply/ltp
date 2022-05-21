typedef unsigned char          u8;
typedef unsigned short int     u16;
typedef unsigned int           u32;
typedef unsigned long long int u64;

typedef float  f32;
typedef double f64;

typedef char          i8;
typedef short int     i16;
typedef int           i32;
typedef long long int i64;

typedef unsigned int usize;

typedef unsigned char byte;
typedef byte u8;
///*
typedef byte string_u8;
typedef byte string_u16;
typedef byte string_u32;
typedef byte buffer_u8;
typedef byte buffer_u16;
typedef byte buffer_u32;
typedef byte array_u8;
typedef byte array_u16;
typedef byte array_u32;

#define bytes_u8  1
#define bytes_u16 2
#define bytes_u32 4
#define bytes_u64 8

#define bytes_i8  1
#define bytes_i16 2
#define bytes_i32 4
#define bytes_i64 8

#define bytes_f32 4
#define bytes_f64 8

//#define CAT(a,b,c) ##a##b##c

void _memcpy (byte* dest, byte* source, u32 length) {
  for(u32 i = 0; i < length; i++)
    *(byte*)(dest + i) = *(source + i);
}

int _strlen (char* c) {
  int i = 0;
  //return *c
  while(0 != *(char*)(c+i)) i++;
  return i;
}


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

#define size_t int

#define ltp_encode_decode_int(INT_TYPE) \
  int ltp_decode__##INT_TYPE (byte* buf) { return (int)*(INT_TYPE*)(buf); } \
  size_t ltp_encode__##INT_TYPE (byte* buf, INT_TYPE val) { *(INT_TYPE*)buf = val; return sizeof(INT_TYPE); }

//decode_repl takes a pointer, reads the relp from it, and returns a new pointer.
//encode_repl, takes two pointers. one is where the relp is stored, the other is what it points to.

#define ltp_encode_decode_relp(INT_TYPE) \
  byte* ltp_decode_relp__##INT_TYPE (byte* buf) { \
    INT_TYPE v = ltp_decode__##INT_TYPE(buf); \
    return (byte*)(v == 0 ? 0 : buf + v) ; \
  } \
  size_t ltp_encode_relp__##INT_TYPE (byte* relp, byte* target) { \
    *(INT_TYPE*)relp = (INT_TYPE)(target - relp); \
    return sizeof(INT_TYPE); \
   }

ltp_encode_decode_int(u8)
ltp_encode_decode_int(u16)
ltp_encode_decode_int(u32)
ltp_encode_decode_int(u64)

ltp_encode_decode_int(i8)
ltp_encode_decode_int(i16)
ltp_encode_decode_int(i32)
ltp_encode_decode_int(i64)

ltp_encode_decode_int(f32)
ltp_encode_decode_int(f64)


ltp_encode_decode_relp(u8)
ltp_encode_decode_relp(u16)
ltp_encode_decode_relp(u32)
ltp_encode_decode_relp(u64)
//do we want signed relative pointers?
//it's needed to have cyclic objects.

byte* ltp_decode_string__u32 (byte* buf) {
  return (byte*)(buf + sizeof(u32));
}

//decode__length. checks that length actually points at 0 byte
// returns -1 if not, otherwise returns the length.
// the length does not include the null terminator 0
// so this is the same as would be returned by strlen
// https://www.programiz.com/c-programming/library-function/string.h/strlen

// string_u8

#define ltp_decode__length__string(X) \
int ltp_decode__length__string_##X (byte * buf) { \
  int length = ltp_decode__##X(buf); \
  if(0 != ltp_decode__##X(buf+sizeof(X)+length-1)) return -1; \
  return length - 1; \
}

//return the byte size needed to encode, including 0 ending
#define ltp_encoding_length__string(X) \
int ltp_encoding_length__string_##X (X string_length) { \
  return sizeof(X) + string_length + 1; \
}


//check the length, if it's valid return pointer to string, else return null pointer.
#define ltp_decode__string(X) \
byte* ltp_decode__string_##X (byte* buf) { \
  int length = ltp_decode__length__string_##X(buf); \
  if(~length) return (byte*)(buf + sizeof(X)); \
  return 0; \
}


//length includes the null at the end of the string
#define ltp_encode__string(X) \
size_t ltp_encode__string_##X (byte* buf, X string_length, char *string) { \
  ltp_encode__##X(buf, string_length+1); \
  _memcpy(buf+sizeof(X), (byte*)string, (u32)string_length); \
  *(buf+sizeof(X)+string_length) = 0;\
  return (size_t)(sizeof(X) + string_length + 1); \
}

ltp_encoding_length__string(u8)
ltp_decode__length__string(u8)
ltp_decode__string(u8)
ltp_encode__string(u8)

ltp_encoding_length__string(u16)
ltp_decode__length__string(u16)
ltp_decode__string(u16)
ltp_encode__string(u16)

ltp_encoding_length__string(u32)
ltp_decode__length__string(u32)
ltp_decode__string(u32)
ltp_encode__string(u32)

// Buffer - buffer is just raw memory without 0 terminator and no check
//          can be used to encode any object where we can just copy the whole thing in.
#define ltp_encoding_length__buffer(X) \
int ltp_encoding_length__buffer_##X (X length) { \
  return sizeof(X) + length; \
}


#define ltp_decode__length__buffer(X) \
int ltp_decode__length__buffer_##X (byte * buf) { \
  return ltp_decode__##X(buf); \
}

//check the length, if it's valid return pointer to string, else return null pointer.
#define ltp_decode__buffer(X) \
byte* ltp_decode__buffer_##X (byte* buf) { \
  int length = ltp_decode__length__buffer_##X(buf); \
  if(length) return (byte*)(buf + sizeof(X)); \
  return 0; \
}

//length includes the null at the end of the string
#define ltp_encode__buffer(X) \
size_t ltp_encode__buffer_##X (byte* buf, int buffer_length, char *buffer) { \
  ltp_encode__##X(buf, buffer_length); \
  _memcpy(buf+sizeof(X), (byte*)buffer, (u32)buffer_length); \
  return (size_t)(sizeof(X) + buffer_length); \
}

ltp_encoding_length__buffer(u8)
ltp_decode__length__buffer(u8)
ltp_decode__buffer(u8)
ltp_encode__buffer(u8)

ltp_encoding_length__buffer(u16)
ltp_decode__length__buffer(u16)
ltp_decode__buffer(u16)
ltp_encode__buffer(u16)

ltp_encoding_length__buffer(u32)
ltp_decode__length__buffer(u32)
ltp_decode__buffer(u32)
ltp_encode__buffer(u32)

//Fixed size buffer. always the same number of bytes, used for hashes etc

//check the length, if it's valid return pointer to string, else return null pointer.
#define ltp_decode__fixed(X) \
byte* ltp_decode__fixed_##X (byte* buf) { \
  return buf; \
} 

//length includes the null at the end of the string
#define ltp_encode__fixed(X) \
size_t ltp_encode__fixed_##X (byte* buf, char *buffer) { \
  _memcpy(buf, (byte*)buffer, X); \
  return (size_t)X; \
}

typedef byte fixed_4[4];
typedef byte fixed_16[16];
typedef byte fixed_20[20];
typedef byte fixed_32[32];
typedef byte fixed_64[64];

ltp_decode__fixed(4); //ipv4 address
ltp_encode__fixed(4); 

ltp_decode__fixed(16); //ipv6 address
ltp_encode__fixed(16);

ltp_decode__fixed(20); //sha1
ltp_encode__fixed(20);

ltp_decode__fixed(32); //sha256
ltp_encode__fixed(32);

ltp_decode__fixed(64); //sha3
ltp_encode__fixed(64);

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


//does nothing but makes the compiler shutup
size_t ltp_encode__array_u8 (byte* buf, u8 array_length, byte* a[]) {
  return 0;
}

int ltp_decode_array_length__u8(byte* buf) {
  return ltp_decode__u8(buf) / sizeof(u8);
}

byte* ltp_decode_array_index__u8(byte* buf, int index) {
  int length = ltp_decode__u8(buf);
  if(length - sizeof(u8) < index*sizeof(u8)) //out of bounds
    return 0;
  return ltp_decode_relp__u8((byte*)(buf+sizeof(u8)+sizeof(u8)*index));
}

typedef int (*equality_test)(byte* a, byte* b);

int ltp_equals__string_u8 (string_u8* a, string_u8* b) {
  //check if the same string painter
  if(a == b) return 1;
///*
  int length_a = ltp_decode__u8(a);
  int length_b = ltp_decode__u8(b);
  if(length_a != length_b) return 0;
  for(int i = 0; i < length_a; i++) {
//*/
/*
  if(a->length != b->length) return 0;
  for(int i = 0; i < a->length; i++) {
//*/
//    if(decode__u8(a->content[i]) != decode__u8(b->content[i]))
    if(ltp_decode__u8(a+i+sizeof(u8)) != ltp_decode__u8(b+i+sizeof(u8)))
      return 0;
  }
  return 1;
}

int ltp_equals__addr (byte* a, byte* b) {
  return a == b ? 1 : 0;
}

//for each is just a loop so using break/return inside gives you find
#define for_each(ary_p, i, v, decode, each) { \
  byte* end = (byte*)(ary_p + ltp_decode__u8(ary_p) + sizeof(u8)); \
  for(byte* p = ary_p + sizeof(u8); p < end; p += sizeof(u8)) { \
    v = decode(p); \
    each ; i++; \
  } \
};

int ltp_array_index_of__u8(byte* ary, byte* target, equality_test fn ) {
  int i = 0; byte* v;
  for_each(ary, i, v, ltp_decode_relp__u8, if(ltp_equals__string_u8(v, target)) return i;);
}

int ltp_array_index_of__string_u8(byte* ary, byte* target) {
  return ltp_array_index_of__u8(ary, target, ltp_equals__addr);
}

// ----------------- ENCODE ----

//todo: sort (can do a quicksort in-place, changing only the relpointers)
//todo: binary search (only if the array is sorted)
