/**
 * NetCalc Pro - Subnet Overlap Detector
 */
const Overlap = (() => {

  function parseCidr(str) {
    const trimmed = str.trim();
    if (!trimmed.includes('/')) throw new Error(`CIDR notation required: "${trimmed}"`);
    const [ip, cidr] = trimmed.split('/');
    return IPv4.calculate(ip.trim(), parseInt(cidr, 10));
  }

  function relationshipBetween(a, b) {
    const aStart = a.network.int, aEnd = a.broadcast.int;
    const bStart = b.network.int, bEnd = b.broadcast.int;

    if (aEnd < bStart || bEnd < aStart) return { overlap: false, type: 'disjoint' };

    if (aStart === bStart && aEnd === bEnd) return { overlap: true, type: 'identical' };

    if (aStart <= bStart && aEnd >= bEnd) return { overlap: true, type: 'a_contains_b' };
    if (bStart <= aStart && bEnd >= aEnd) return { overlap: true, type: 'b_contains_a' };

    return { overlap: true, type: 'partial' };
  }

  function analyze(networks) {
    if (!networks || networks.length === 0) {
      throw new Error('At least one network required');
    }
    if (networks.length === 1) {
      throw new Error('At least 2 networks required for comparison');
    }

    const parsed = networks.map((n, i) => ({
      index: i,
      original: n,
      ...parseCidr(n)
    }));

    const conflicts = [];
    for (let i = 0; i < parsed.length; i++) {
      for (let j = i + 1; j < parsed.length; j++) {
        const rel = relationshipBetween(parsed[i], parsed[j]);
        if (rel.overlap) {
          conflicts.push({
            a: parsed[i],
            b: parsed[j],
            type: rel.type,
            indexA: i,
            indexB: j
          });
        }
      }
    }

    return {
      networks: parsed,
      conflicts,
      summary: {
        total: parsed.length,
        conflictCount: conflicts.length,
        clean: conflicts.length === 0
      }
    };
  }

  return { parseCidr, relationshipBetween, analyze };
})();

window.Overlap = Overlap;
