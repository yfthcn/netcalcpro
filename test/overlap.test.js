const { suite, test, eq, throws } = require("./harness");

suite("Overlap");

test("containment detected (a contains b)", () => {
  const r = Overlap.analyze(["10.0.0.0/24", "10.0.0.128/25"]);
  eq(r.summary.conflictCount, 1);
  eq(r.summary.clean, false);
  eq(r.conflicts[0].type, "a_contains_b");
});

test("reverse containment (b contains a)", () => {
  const r = Overlap.analyze(["10.0.0.128/25", "10.0.0.0/24"]);
  eq(r.conflicts[0].type, "b_contains_a");
});

test("identical networks", () => {
  const r = Overlap.analyze(["10.0.0.0/24", "10.0.0.0/24"]);
  eq(r.conflicts[0].type, "identical");
});

test("disjoint networks are clean", () => {
  const r = Overlap.analyze(["10.0.0.0/24", "10.1.0.0/24"]);
  eq(r.summary.conflictCount, 0);
  eq(r.summary.clean, true);
});

test("validation", () => {
  throws(() => Overlap.analyze(["10.0.0.0/24"])); // need >= 2
  throws(() => Overlap.parseCidr("10.0.0.0")); // missing /prefix
});
