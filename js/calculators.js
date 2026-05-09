/**
 * NetCalc Pro - Routing Protocol Metric Calculators
 */

const OSPFCalc = {
  cost(refBwMbps, ifaceBwMbps) {
    if (ifaceBwMbps <= 0) throw new Error('Interface BW must be > 0');
    if (refBwMbps <= 0) throw new Error('Reference BW must be > 0');
    const cost = Math.floor(refBwMbps / ifaceBwMbps);
    return Math.max(1, cost);
  }
};

const EIGRPCalc = {
  /**
   * Classic metric (×256):
   * BW_term = 10^7 / min_bw_kbps
   * Delay_term = sum_delay_us / 10
   * metric = (K1*BW + K2*BW/(256-load) + K3*Delay) * 256
   * If K5 != 0: metric *= (K5 / (reliability + K4))
   */
  metric({ bw, delay, load = 1, reliability = 255, k1 = 1, k2 = 0, k3 = 1, k4 = 0, k5 = 0 }) {
    if (bw <= 0) throw new Error('Bandwidth must be > 0');
    if (delay < 0) throw new Error('Delay must be >= 0');
    if (load < 1 || load > 255) throw new Error('Load must be 1-255');
    if (reliability < 1 || reliability > 255) throw new Error('Reliability must be 1-255');

    const bwTerm = Math.floor(10000000 / bw);
    const delayTerm = Math.floor(delay / 10);

    let inner = k1 * bwTerm;
    if (k2 > 0) inner += Math.floor((k2 * bwTerm) / (256 - load));
    inner += k3 * delayTerm;

    let metric = inner * 256;

    let k5Applied = false;
    if (k5 !== 0) {
      const factor = k5 / (reliability + k4);
      metric = Math.floor(metric * factor);
      k5Applied = true;
    }

    return {
      metric,
      bwTerm, delayTerm,
      formula: k5 === 0
        ? `(${k1}×${bwTerm} + ${k3}×${delayTerm}) × 256 = ${metric}`
        : `((K1×BW + K3×Delay) × K5/(R+K4)) × 256 = ${metric}`,
      k5Applied
    };
  }
};

// ===== Range ↔ CIDR =====
const RangeCidr = {
  rangeToCidrs(startIp, endIp) {
    let s = IPv4.ipToInt(startIp);
    const e = IPv4.ipToInt(endIp);
    if (s > e) throw new Error('Start IP cannot exceed End IP');

    const blocks = [];
    while (s <= e) {
      let maxBlock = 32;
      while (maxBlock > 0) {
        const blockSize = Math.pow(2, 32 - (maxBlock - 1));
        if (s % blockSize !== 0) break;
        if (s + blockSize - 1 > e) break;
        maxBlock--;
      }
      const blockSize = Math.pow(2, 32 - maxBlock);
      const block = IPv4.calculate(IPv4.intToIp(s >>> 0), maxBlock);
      blocks.push(block);
      s += blockSize;
      if (blocks.length > 1024) throw new Error('Too many blocks (>1024)');
    }

    return {
      start: startIp,
      end: endIp,
      totalIps: blocks.reduce((sum, b) => sum + b.counts.total, 0),
      blocks,
      blockCount: blocks.length
    };
  },

  cidrToRange(cidrStr) {
    const [ip, prefix] = cidrStr.split('/');
    if (!prefix) throw new Error('CIDR notation required');
    const c = IPv4.calculate(ip.trim(), parseInt(prefix, 10));
    return {
      cidr: c.network.cidrNotation,
      first: c.network.decimal,
      last: c.broadcast.decimal,
      count: c.counts.total
    };
  }
};

// ===== Ping Sweep =====
const PingSweep = {
  generate(cidrStr, format = 'newline') {
    const [ip, prefix] = cidrStr.split('/');
    if (!prefix) throw new Error('CIDR notation required');
    const c = IPv4.calculate(ip.trim(), parseInt(prefix, 10));
    if (c.counts.total > 4096) throw new Error('Subnet too large (max 4096 IPs)');

    const ips = [];
    if (c.cidr === 32) {
      ips.push(c.network.decimal);
    } else if (c.cidr === 31) {
      ips.push(c.network.decimal, c.broadcast.decimal);
    } else {
      for (let i = c.firstHost.int; i <= c.lastHost.int; i++) {
        ips.push(IPv4.intToIp(i >>> 0));
      }
    }

    const formats = {
      newline: ips.join('\n'),
      comma:   ips.join(', '),
      space:   ips.join(' '),
      bash:    `for ip in ${ips.join(' ')}; do\n  ping -c1 -W1 -q $ip > /dev/null && echo "$ip is up"\ndone`,
      nmap:    `nmap -sn ${ips.join(' ')}`,
      fping:   `fping -a -q ${ips.join(' ')}`
    };

    return {
      network: c.network.cidrNotation,
      count: ips.length,
      ips,
      output: formats[format] || formats.newline,
      allFormats: formats
    };
  }
};

// ===== PTR / Reverse DNS =====
const PTRGen = {
  ipv4(ip) {
    IPv4.ipToInt(ip);
    const reversed = ip.split('.').reverse().join('.');
    return `${reversed}.in-addr.arpa`;
  },

  ipv6(addr) {
    const expanded = IPv6.expand(addr);
    const hex = expanded.replace(/:/g, '');
    const reversed = hex.split('').reverse().join('.');
    return `${reversed}.ip6.arpa`;
  },

  generate(input) {
    const trimmed = input.trim();

    if (trimmed.includes('/')) {
      const [ip, prefix] = trimmed.split('/');
      if (ip.includes('.')) {
        const c = IPv4.calculate(ip.trim(), parseInt(prefix, 10));
        if (c.counts.total > 256) throw new Error('Bulk PTR max 256 IPs');
        const list = [];
        for (let i = c.network.int; i <= c.broadcast.int; i++) {
          const ipStr = IPv4.intToIp(i >>> 0);
          list.push({ ip: ipStr, ptr: PTRGen.ipv4(ipStr) });
        }
        return { type: 'ipv4-range', count: list.length, list };
      }
      throw new Error('IPv6 CIDR PTR not currently supported');
    }

    if (trimmed.includes(':')) {
      return { type: 'ipv6', ip: trimmed, ptr: PTRGen.ipv6(trimmed) };
    } else {
      return { type: 'ipv4', ip: trimmed, ptr: PTRGen.ipv4(trimmed) };
    }
  }
};

window.OSPFCalc = OSPFCalc;
window.EIGRPCalc = EIGRPCalc;
window.RangeCidr = RangeCidr;
window.PingSweep = PingSweep;
window.PTRGen = PTRGen;
