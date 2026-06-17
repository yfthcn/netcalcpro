const { suite, test, eq, deep, throws, ok } = require("./harness");

suite("OSPF / EIGRP / Range / PingSweep / PTR");

// --- OSPF ---
test("OSPF cost = ref / iface, floored, min 1", () => {
  eq(OSPFCalc.cost(10000, 100), 100);
  eq(OSPFCalc.cost(100, 100), 1);
  eq(OSPFCalc.cost(100, 1000), 1); // floor(0.1) -> clamped to 1
  throws(() => OSPFCalc.cost(100, 0));
});

// --- EIGRP ---
test("EIGRP classic metric for 10 Mbps / 1000us = 281600", () => {
  const r = EIGRPCalc.metric({ bw: 10000, delay: 1000 });
  eq(r.metric, 281600);
  eq(r.bwTerm, 1000);
  eq(r.delayTerm, 100);
});

test("EIGRP metric for 1 Gbps / 100us", () => {
  eq(EIGRPCalc.metric({ bw: 1000000, delay: 100 }).metric, 5120);
});

test("EIGRP validation", () => {
  throws(() => EIGRPCalc.metric({ bw: 0, delay: 10 }));
  throws(() => EIGRPCalc.metric({ bw: 1000, delay: 10, load: 0 }));
});

// --- Range <-> CIDR ---
test("rangeToCidrs collapses a full /24", () => {
  const r = RangeCidr.rangeToCidrs("192.168.1.0", "192.168.1.255");
  eq(r.blockCount, 1);
  eq(r.blocks[0].network.cidrNotation, "192.168.1.0/24");
  eq(r.totalIps, 256);
});

test("rangeToCidrs handles unaligned range", () => {
  // 10.0.0.1 - 10.0.0.2 cannot be one block -> two /32s
  eq(RangeCidr.rangeToCidrs("10.0.0.1", "10.0.0.2").blockCount, 2);
});

test("rangeToCidrs rejects start > end", () => {
  throws(() => RangeCidr.rangeToCidrs("10.0.0.10", "10.0.0.1"));
});

test("cidrToRange", () => {
  const r = RangeCidr.cidrToRange("10.0.0.0/24");
  eq(r.first, "10.0.0.0");
  eq(r.last, "10.0.0.255");
  eq(r.count, 256);
});

// --- Ping sweep ---
test("pingSweep lists usable hosts of a /30", () => {
  const r = PingSweep.generate("192.168.1.0/30");
  eq(r.count, 2);
  deep(r.ips, ["192.168.1.1", "192.168.1.2"]);
});

test("pingSweep /31 lists both addresses", () => {
  deep(PingSweep.generate("192.168.1.0/31").ips, ["192.168.1.0", "192.168.1.1"]);
});

test("pingSweep rejects oversized subnet", () => {
  throws(() => PingSweep.generate("10.0.0.0/19")); // 8192 > 4096 cap
});

// --- PTR / reverse DNS ---
test("PTR ipv4", () => {
  eq(PTRGen.ipv4("8.8.8.8"), "8.8.8.8.in-addr.arpa");
  eq(PTRGen.generate("1.2.3.4").ptr, "4.3.2.1.in-addr.arpa");
  eq(PTRGen.generate("1.2.3.4").type, "ipv4");
});

test("PTR ipv6", () => {
  const ptr = PTRGen.ipv6("::1");
  ok(ptr.endsWith(".ip6.arpa"), "ends with .ip6.arpa");
  ok(ptr.startsWith("1.0.0.0"), "nibble-reversed");
  eq(PTRGen.generate("2001:db8::1").type, "ipv6");
});
