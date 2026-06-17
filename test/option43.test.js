const { suite, test, eq, deep, throws } = require("./harness");

suite("Option43 (DHCP TLV)");

test("generate single Cisco WLC IP", () => {
  const r = Option43.generate("cisco", ["192.168.10.5"]);
  eq(r.type, "f1");
  eq(r.length, "04");
  eq(r.formats.ciscoFlat, "f104c0a80a05");
  deep(r.valueBytes, ["c0", "a8", "0a", "05"]);
});

test("generate multiple Cisco WLC IPs", () => {
  const r = Option43.generate("cisco", ["10.1.1.1", "10.1.1.2"]);
  eq(r.length, "08");
  eq(r.formats.ciscoFlat, "f1080a0101010a010102");
});

test("vendor codes", () => {
  eq(Option43.generate("ruckus_zd", ["10.0.0.1"]).type, "06");
  eq(Option43.generate("ruckus_scg", ["10.0.0.1"]).type, "03");
});

test("generate validation", () => {
  throws(() => Option43.generate("cisco", []));
  throws(() => Option43.generate("nope", ["10.0.0.1"]));
  throws(() => Option43.generate("cisco", Array(17).fill("10.0.0.1")));
});

test("decode classic", () => {
  const d = Option43.decode("f104c0a80a05");
  eq(d.type, "f1");
  eq(d.length, 4);
  eq(d.ipCount, 1);
  deep(d.ips, ["192.168.10.5"]);
  eq(d.fom, false);
  eq(d.vendor, "Cisco WLC (classic)");
});

test("generate → decode round-trip", () => {
  const flat = Option43.generate("cisco", ["172.16.5.10", "192.168.1.1"]).formats.ciscoFlat;
  deep(Option43.decode(flat).ips, ["172.16.5.10", "192.168.1.1"]);
});

test("FOM (Wi-Fi 7) generate + decode", () => {
  const r = Option43.generate("cisco", ["10.0.0.1"], { fom: true });
  eq(r.type, "f3");
  eq(r.length, "05");
  eq(r.formats.ciscoFlat, "f3050a00000102"); // f3 05 0a000001 02(catalyst)
  const d = Option43.decode("f3050a00000102");
  eq(d.fom, true);
  eq(d.fomMode, "Catalyst");
  deep(d.ips, ["10.0.0.1"]);
});

test("decode validation", () => {
  throws(() => Option43.decode("zz04c0a80a05")); // invalid hex
  throws(() => Option43.decode("f108c0a80a05")); // length/value mismatch
});
