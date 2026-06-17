/**
 * NetCalc Pro — test runner.
 * Usage: node test/run.js
 * Exit code 0 = all passed, 1 = at least one failure (used by CI).
 */
const { report } = require("./harness");

require("./ipv4.test");
require("./ipv6.test");
require("./option43.test");
require("./numbase.test");
require("./overlap.test");
require("./calculators.test");

report();
