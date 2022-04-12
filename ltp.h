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

#define bytes_u8  1
#define bytes_u16 2
#define bytes_u32 4
#define bytes_u64 8

#define bytes_i8  1
#define bytes_i16 2
#define bytes_i32 4
#define bytes_i64 8

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
int ltp_decode__length__string_u8 (byte * buf) {
  int length = ltp_decode__u8(buf);
//  if(0 != decode__u8(buf+sizeof(u8)+length)) return -1;
  if(0 != ltp_decode__u8(buf+sizeof(u8)+length-1)) return -1;
  return length - 1;
}

//check the length, if it's valid return pointer to string, else return null pointer.
byte* ltp_decode__string_u8 (byte* buf) {
  int length = ltp_decode__length__string_u8(buf);
  if(~length)
    return (byte*)(buf + sizeof(u8));
}

//length includes the null at the end of the string
size_t ltp_encode__string_u8 (byte* buf, char *string) {
  u32 string_length = _strlen(string)+1;
  ltp_encode__u8(buf, string_length);
  _memcpy(buf+bytes_u8, (byte*)string, (u32)string_length);
  return (size_t)(bytes_u8 + string_length);
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
