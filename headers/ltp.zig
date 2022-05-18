//
const mem = @import("std").mem;

fn decode_n (comptime T:anytype, buf:[*]u8) T {
  return mem.readIntLittle(T, buf[0..@sizeOf(T)]);
}
fn encode_n (comptime T:anytype, buf:[*]u8, value: T) void {
  mem.writeIntLittle(T, @ptrCast(*[@sizeOf(T)]u8, buf), value);
}


export fn ltp_decode__u8  (buf: [*]u8) u8  { return decode_n(u8, buf); }
export fn ltp_decode__u16 (buf: [*]u8) u16 { return decode_n(u16, buf); }
export fn ltp_decode__u32 (buf: [*]u8) u32 { return decode_n(u32, buf); }
export fn ltp_decode__u64 (buf: [*]u8) u64 { return decode_n(u64, buf); }

export fn ltp_decode__i8  (buf: [*]u8) i8  { return decode_n(i8, buf); }
export fn ltp_decode__i16 (buf: [*]u8) i16 { return decode_n(i16, buf); }
export fn ltp_decode__i32 (buf: [*]u8) i32 { return decode_n(i32, buf); }
export fn ltp_decode__i64 (buf: [*]u8) i64 { return decode_n(i64, buf); }

export fn ltp_encode__u8  (buf: [*]u8, value: u8)  void { encode_n(u8, buf, value); }
export fn ltp_encode__u16 (buf: [*]u8, value: u16) void { encode_n(u16, buf, value); }
export fn ltp_encode__u32 (buf: [*]u8, value: u32) void { encode_n(u32, buf, value); }
export fn ltp_encode__u64 (buf: [*]u8, value: u64) void { encode_n(u64, buf, value); }

export fn ltp_encode__i8  (buf: [*]u8, value: i8)  void { encode_n(i8,  buf, value); }
export fn ltp_encode__i16 (buf: [*]u8, value: i16) void { encode_n(i16, buf, value); }
export fn ltp_encode__i32 (buf: [*]u8, value: i32) void { encode_n(i32, buf, value); }
export fn ltp_encode__i64 (buf: [*]u8, value: i64) void { encode_n(i64, buf, value); }

export fn ltp_encode_relp__u8(buf: [*]u8, target: [*]u8) void {
  encode_n(u8, buf, @intCast(u8, @ptrToInt(target) - @ptrToInt(buf)));
}
export fn ltp_encode_relp__u16(buf: [*]u8, target: [*]u8) void {
  encode_n(u16, buf, @intCast(u16, @ptrToInt(target) - @ptrToInt(buf)));
}
export fn ltp_encode_relp__u32(buf: [*]u8, target: [*]u8) void {
  encode_n(u32, buf, @intCast(u32, @ptrToInt(target) - @ptrToInt(buf)));
}
export fn ltp_decode_relp__u8(buf: [*]u8) [*]u8 {
  return @intToPtr([*]u8, @ptrToInt(buf) + decode_n(u8, buf));
}
export fn ltp_decode_relp__u16(buf: [*]u8) [*]u8 {
  return @intToPtr([*]u8, @ptrToInt(buf) + decode_n(u16, buf));
}
export fn ltp_decode_relp__u32(buf: [*]u8) [*]u8 {
  return @intToPtr([*]u8, @ptrToInt(buf) + decode_n(u32, buf));
}

export fn ltp_decode__length__string_u8 (buf: [*]u8) usize {
  return ltp_decode__u8(buf)-1;
}

export fn ltp_decode__string_u8 (buf: [*]u8) [*]u8 {
  return buf+1;
}

export fn ltp_encode__string_u8 (buf: [*]u8, len: usize, value: [*]u8) usize {
//  var len = mem.len(value)+1;
  encode_n(u8, buf, @intCast(u8, len));
  @memcpy(buf+@sizeOf(u8), value, len);
  return @sizeOf(u8) + len;
}
export fn ltp_encode__string_u16 (buf: [*]u8, len: usize, value: [*:0]const u8) usize {
//  var len = mem.len(value)+1;
  encode_n(u16, buf, @intCast(u16, len));
  @memcpy(buf+@sizeOf(u16), value, len);
  return @sizeOf(u16) + len;
}
export fn ltp_encode__string_u32 (buf: [*]u8, len: usize, value: [*:0]const u8) usize {
//  var len = mem.len(value)+1;
  encode_n(u32, buf, @intCast(u32, len));
  @memcpy(buf+@sizeOf(u32), value, len);
  return @sizeOf(u32) + len;
}

export fn ltp_encode__fixed_4 (buf: [*]u8, fixed: *[4]u8) void {
  buf[0..4].* = fixed.*;
}
export fn ltp_encode__fixed_8 (buf: [*]u8, fixed: *[8]u8) void {
  buf[0..8].* = fixed.*;
}
export fn ltp_encode__fixed_16 (buf: [*]u8, fixed: *[16]u8) void {
  buf[0..16].* = fixed.*;
}
export fn ltp_encode__fixed_32 (buf: [*]u8, fixed: *[32]u8) void {
  buf[0..32].* = fixed.*;
}
export fn ltp_encode__fixed_64 (buf: [*]u8, fixed: *[64]u8) void {
  buf[0..64].* = fixed.*;
}

export fn ltp_decode__fixed_4  (buf: [*]u8)  *[4]u8 {
  return buf[0..4];
}
export fn ltp_decode__fixed_8  (buf: [*]u8)  *[8]u8 {
  return buf[0..8];
}
export fn ltp_decode__fixed_16 (buf: [*]u8) *[16]u8 {
  return buf[0..16];
}
export fn ltp_decode__fixed_32 (buf: [*]u8) *[32]u8 {
  return buf[0..32];
}
export fn ltp_decode__fixed_64 (buf: [*]u8) *[64]u8 {
  return buf[0..64];
}