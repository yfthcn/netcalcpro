const { suite, test, eq, deep, throws } = require("./harness");

suite("IPv4");

// --- Conversions ---
test("ipToInt boundaries", () => {
  eq(IPv4.ipToInt("0.0.0.0"), 0);
  eq(IPv4.ipToInt("255.255.255.255"), 4294967295);
  eq(IPv4.ipToInt("192.168.0.1"), 3232235521);
});

test("ipToInt rejects malformed input", () => {
  throws(() => IPv4.ipToInt("256.0.0.1"));
  throws(() => IPv4.ipToInt("1.2.3"));
  throws(() => IPv4.ipToInt("1.2.3.4.5"));
  throws(() => IPv4.ipToInt("a.b.c.d"));
});

test("intToIp round-trips", () => {
  eq(IPv4.intToIp(0), "0.0.0.0");
  eq(IPv4.intToIp(3232235521), "192.168.0.1");
  eq(IPv4.intToIp(IPv4.ipToInt("10.20.30.40")), "10.20.30.40");
});

test("cidrToMask", () => {
  eq(IPv4.cidrToMask(0), 0);
  eq(IPv4.cidrToMask(24), 4294967040); // 255.255.255.0
  eq(IPv4.cidrToMask(32), 4294967295);
  throws(() => IPv4.cidrToMask(33));
});

test("maskToCidr accepts contiguous, rejects holes", () => {
  eq(IPv4.maskToCidr(IPv4.ipToInt("255.255.255.0")), 24);
  eq(IPv4.maskToCidr(IPv4.ipToInt("255.255.255.192")), 26);
  throws(() => IPv4.maskToCidr(IPv4.ipToInt("255.0.255.0")));
});

test("wildcardFromMask", () => {
  eq(IPv4.wildcardFromMask(IPv4.cidrToMask(24)), 255);
});

// --- Classification ---
test("ipClass", () => {
  eq(IPv4.ipClass(IPv4.ipToInt("8.0.0.0")), "A");
  eq(IPv4.ipClass(IPv4.ipToInt("130.0.0.0")), "B");
  eq(IPv4.ipClass(IPv4.ipToInt("200.0.0.0")), "C");
  eq(IPv4.ipClass(IPv4.ipToInt("224.0.0.0")), "D (Multicast)");
  eq(IPv4.ipClass(IPv4.ipToInt("240.0.0.0")), "E (Reserved)");
});

test("ipType", () => {
  eq(IPv4.ipType(IPv4.ipToInt("127.0.0.1")), "Loopback");
  eq(IPv4.ipType(IPv4.ipToInt("10.1.1.1")), "Private (RFC 1918)");
  eq(IPv4.ipType(IPv4.ipToInt("172.16.5.4")), "Private (RFC 1918)");
  eq(IPv4.ipType(IPv4.ipToInt("169.254.1.1")), "Link-local (APIPA)");
  eq(IPv4.ipType(IPv4.ipToInt("100.64.0.1")), "CGNAT (RFC 6598)");
  eq(IPv4.ipType(IPv4.ipToInt("8.8.8.8")), "Public");
});

// --- Subnet calculation ---
test("calculate /24", () => {
  const r = IPv4.calculate("192.168.1.10", 24);
  eq(r.network.decimal, "192.168.1.0");
  eq(r.broadcast.decimal, "192.168.1.255");
  eq(r.mask.decimal, "255.255.255.0");
  eq(r.firstHost.decimal, "192.168.1.1");
  eq(r.lastHost.decimal, "192.168.1.254");
  eq(r.counts.total, 256);
  eq(r.counts.usable, 254);
  eq(r.network.cidrNotation, "192.168.1.0/24");
  eq(r.meta.class, "C");
});

test("calculate /8", () => {
  const r = IPv4.calculate("10.0.0.5", 8);
  eq(r.network.decimal, "10.0.0.0");
  eq(r.broadcast.decimal, "10.255.255.255");
  eq(r.counts.total, 16777216);
  eq(r.counts.usable, 16777214);
});

test("calculate /31 is point-to-point (RFC 3021)", () => {
  const r = IPv4.calculate("10.0.0.0", 31);
  eq(r.counts.usable, 2);
  eq(r.meta.isPointToPoint, true);
  eq(r.firstHost.decimal, "10.0.0.0");
  eq(r.lastHost.decimal, "10.0.0.1");
});

test("calculate /32 is host route", () => {
  const r = IPv4.calculate("10.0.0.1", 32);
  eq(r.counts.usable, 1);
  eq(r.meta.isHostRoute, true);
});

test("calculate rejects bad input", () => {
  throws(() => IPv4.calculate("192.168.1.1", 33));
  throws(() => IPv4.calculate("999.1.1.1", 24));
});

// --- VLSM ---
test("vlsm allocates largest-first, returns original order", () => {
  const r = IPv4.vlsm("192.168.1.0", 24, [
    { name: "A", hosts: 50 },
    { name: "B", hosts: 20 },
    { name: "C", hosts: 10 },
  ]);
  eq(r.summary.successful, 3);
  eq(r.subnets[0].network.decimal, "192.168.1.0");
  eq(r.subnets[0].cidr, 26);
  eq(r.subnets[1].network.decimal, "192.168.1.64");
  eq(r.subnets[1].cidr, 27);
  eq(r.subnets[2].network.decimal, "192.168.1.96");
  eq(r.subnets[2].cidr, 28);
});

// --- Supernetting ---
test("summarize two /24s into one /23", () => {
  const r = IPv4.summarize(["192.168.0.0/24", "192.168.1.0/24"]);
  eq(r.supernet.network.cidrNotation, "192.168.0.0/23");
  eq(r.supernet.counts.total, 512);
});

// --- Membership ---
test("contains", () => {
  eq(IPv4.contains("10.0.0.0", 8, "10.5.4.3"), true);
  eq(IPv4.contains("10.0.0.0", 8, "11.0.0.1"), false);
});

// --- Split ---
test("splitInto four /26s", () => {
  const r = IPv4.splitInto("192.168.1.0", 24, 26);
  eq(r.totalSubnets, 4);
  deep(
    r.subnets.map((s) => s.network.decimal),
    ["192.168.1.0", "192.168.1.64", "192.168.1.128", "192.168.1.192"]
  );
});
