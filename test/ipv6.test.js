const { suite, test, eq, throws } = require("./harness");

suite("IPv6");

test("expand", () => {
  eq(IPv6.expand("2001:db8::1"), "2001:0db8:0000:0000:0000:0000:0000:0001");
  eq(IPv6.expand("::1"), "0000:0000:0000:0000:0000:0000:0000:0001");
  eq(IPv6.expand("::"), "0000:0000:0000:0000:0000:0000:0000:0000");
});

test("expand rejects bad input", () => {
  throws(() => IPv6.expand("2001::db8::1")); // two "::"
  throws(() => IPv6.expand("xyz::1")); // invalid group
  throws(() => IPv6.expand("1:2:3:4:5:6:7:8:9")); // too long
});

test("compress (RFC 5952)", () => {
  eq(IPv6.compress("2001:0db8:0000:0000:0000:0000:0000:0001"), "2001:db8::1");
  eq(IPv6.compress("ff02:0000:0000:0000:0000:0000:0000:0001"), "ff02::1");
  // first of equal-length zero runs is collapsed
  eq(IPv6.compress("2001:0db8:0000:0000:0001:0000:0000:0001"), "2001:db8::1:0:0:1");
});

test("ipToBigInt / bigIntToIp round-trip", () => {
  eq(IPv6.ipToBigInt("::1"), 1n);
  eq(IPv6.ipToBigInt("::"), 0n);
  eq(
    IPv6.bigIntToIp(IPv6.ipToBigInt("2001:db8::")),
    "2001:0db8:0000:0000:0000:0000:0000:0000"
  );
});

test("prefixToMask", () => {
  eq(IPv6.prefixToMask(0), 0n);
  eq(IPv6.bigIntToIp(IPv6.prefixToMask(64)), "ffff:ffff:ffff:ffff:0000:0000:0000:0000");
  eq(IPv6.bigIntToIp(IPv6.prefixToMask(128)), "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff");
});

test("ipType", () => {
  eq(IPv6.ipType(0n), "Unspecified (::)");
  eq(IPv6.ipType(IPv6.ipToBigInt("::1")), "Loopback (::1)");
  eq(IPv6.ipType(IPv6.ipToBigInt("fe80::1")), "Link-local (fe80::/10)");
  eq(IPv6.ipType(IPv6.ipToBigInt("ff02::1")), "Multicast (ff00::/8)");
  eq(IPv6.ipType(IPv6.ipToBigInt("fc00::1")), "Unique Local (fc00::/7)");
  eq(IPv6.ipType(IPv6.ipToBigInt("2001:db8::1")), "Documentation (2001:db8::/32)");
  eq(IPv6.ipType(IPv6.ipToBigInt("2606:4700::1")), "Global Unicast (2000::/3)");
});

test("calculate /64", () => {
  const r = IPv6.calculate("2001:db8::", 64);
  eq(r.network.compressed, "2001:db8::");
  eq(r.network.cidrNotation, "2001:db8::/64");
  eq(r.lastAddress.compressed, "2001:db8::ffff:ffff:ffff:ffff");
  eq(r.counts.total, "18446744073709551616"); // 2^64
  eq(r.meta.type, "Documentation (2001:db8::/32)");
});
