const { suite, test, eq, throws } = require("./harness");

suite("NumBase");

test("convertAll from decimal", () => {
  const r = NumBase.convertAll("255", 10);
  eq(r.dec, "255");
  eq(r.hex, "FF");
  eq(r.bin, "11111111");
  eq(r.oct, "377");
});

test("convertAll from hex (with and without 0x)", () => {
  eq(NumBase.convertAll("ff", 16).dec, "255");
  eq(NumBase.convertAll("0xff", 16).dec, "255");
});

test("convertAll from binary / octal", () => {
  eq(NumBase.convertAll("1010", 2).dec, "10");
  eq(NumBase.convertAll("1010", 2).hex, "A");
  eq(NumBase.convertAll("777", 8).dec, "511");
});

test("BigInt range (2^64 - 1)", () => {
  eq(NumBase.convertAll("FFFFFFFFFFFFFFFF", 16).dec, "18446744073709551615");
});

test("invalid characters throw", () => {
  throws(() => NumBase.parse("1g", 16));
  throws(() => NumBase.parse("2", 2));
  throws(() => NumBase.parse("8", 8));
});

test("binGrouped pads to byte groups", () => {
  eq(NumBase.binGrouped(255n), "11111111");
  eq(NumBase.binGrouped(256n), "00000001 00000000");
});
