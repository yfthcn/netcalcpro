/**
 * NetCalc Pro — Test harness (zero dependencies)
 *
 * The js/*.js modules are written for the browser: each is an IIFE that
 * assigns its public API to `window.X`. To exercise them in Node we point
 * `window`/`self` at the global object and evaluate each file in dependency
 * order, so `window.IPv4 = IPv4` lands on Node's global. Test files then use
 * IPv4, IPv6, Option43, ... directly.
 *
 * No test framework is used on purpose — the project ships zero dependencies,
 * so its tests do too. Run with: node test/run.js
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

global.window = global;
global.self = global;

const ROOT = path.join(__dirname, "..");

// Dependency order: ipv4/ipv6 first (option43, overlap, calculators rely on them).
const MODULES = [
  "js/ipv4.js",
  "js/ipv6.js",
  "js/option43.js",
  "js/overlap.js",
  "js/numbase.js",
  "js/calculators.js",
];

for (const rel of MODULES) {
  const code = fs.readFileSync(path.join(ROOT, rel), "utf8");
  vm.runInThisContext(code, { filename: rel });
}

// --- Tiny assertion + registry layer ---
let passed = 0;
let failed = 0;
const failures = [];
let currentSuite = "";

function suite(name) {
  currentSuite = name;
}

function test(desc, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    failures.push(`${currentSuite} › ${desc}\n      ${e.message}`);
  }
}

function show(v) {
  return typeof v === "bigint" ? `${v}n` : JSON.stringify(v);
}

// Scalar equality (BigInt-aware).
function eq(actual, expected, msg = "") {
  const a = typeof actual === "bigint" ? actual.toString() : actual;
  const e = typeof expected === "bigint" ? expected.toString() : expected;
  if (a !== e) {
    throw new Error(`${msg} expected ${show(expected)}, got ${show(actual)}`.trim());
  }
}

// Deep equality via JSON (for arrays / plain objects).
function deep(actual, expected, msg = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg} expected ${e}, got ${a}`.trim());
  }
}

function throws(fn, msg = "") {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(`${msg} expected to throw, but it did not`.trim());
}

function ok(cond, msg = "expected truthy value") {
  if (!cond) throw new Error(msg);
}

function report() {
  console.log("");
  if (failed === 0) {
    console.log(`\u2713 All ${passed} tests passed.`);
    process.exit(0);
  }
  console.log(`\u2717 ${failed} failed, ${passed} passed:\n`);
  for (const f of failures) console.log("  \u2717 " + f + "\n");
  process.exit(1);
}

module.exports = { suite, test, eq, deep, throws, ok, report };
