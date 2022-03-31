#include "stdio.h"
#include "string.h"

#pragma pack(1)
typedef struct
{
  short length;
  char body[];
} lstring;

/*
I have figured out the incantations to make a struct that you can cast memory.
such that the memory is a viable encoding, and the struct is usable too.

the breakthrough was realising I could inspect the actual alignment of a struct field
by dereferencing, then print the addresses. Otherwise I didn't know that pack was working as I expected.

Question: hmm, string could use 0 terminated, then it works as a c string, as is
decode should check that there is actually a 0 at the end, then we know it's safe.
*/

/*
char[] create_lstring (char* cstr) {
  //lstring* s;
  lstring* ls;
  int length = strlen(cstr);
  char mem[sizeof(ls->length)+length];
  *(int*)mem = length;
  memcpy(&(mem[sizeof(ls->length)]), cstr, length+1);
  
//  return (lstring)mem;
}
*/

//takes a hello message from cli and then copies it into memory
//then casts to a struct.
int main (int args, char* argv[]) {
  lstring* hello;
  char* string;
  string = argv[1];
  int length = strlen(string);
  char mem[sizeof(hello->length)+length];
  *(int*)mem = length;

  char* m = &(mem[sizeof(hello->length)]);
  memcpy(m, string, length+1);
  hello = (lstring*)(&mem);

  hello->length = strlen(hello->body);
  printf("%s, world\n", &(hello->body));

  printf("addr:%p %i\n", hello, (int)((void*)&(hello->body) - (void*)hello));
}