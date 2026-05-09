/**
 * NetCalc Pro - IPv4 Core Engine
 * Tüm IPv4 hesaplamalarının matematiksel çekirdeği.
 * BigInt yerine 32-bit unsigned işlemler kullanır (>>> 0 ile).
 */

const IPv4 = (() => {

  // ------- Dönüşüm fonksiyonları -------

  function ipToInt(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) throw new Error('Invalid IPv4 format');
    let result = 0;
    for (const p of parts) {
      const n = Number(p);
      if (!Number.isInteger(n) || n < 0 || n > 255 || p === '' || /\D/.test(p)) {
        throw new Error(`Invalid octet: ${p}`);
      }
      result = (result * 256) + n;
    }
    return result >>> 0;
  }

  function intToIp(num) {
    return [
      (num >>> 24) & 0xFF,
      (num >>> 16) & 0xFF,
      (num >>> 8) & 0xFF,
      num & 0xFF
    ].join('.');
  }

  function intToBinary(num, groupBy = 8) {
    const bin = (num >>> 0).toString(2).padStart(32, '0');
    if (groupBy === 8) {
      return bin.match(/.{8}/g).join('.');
    }
    return bin;
  }

  function intToHex(num) {
    return '0x' + (num >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }

  function cidrToMask(cidr) {
    if (cidr < 0 || cidr > 32) throw new Error('CIDR must be between 0 and 32');
    if (cidr === 0) return 0;
    return (0xFFFFFFFF << (32 - cidr)) >>> 0;
  }

  function maskToCidr(mask) {
    // Geçerli mask kontrolü: önce 1'ler, sonra 0'lar olmalı
    const bin = (mask >>> 0).toString(2).padStart(32, '0');
    const match = bin.match(/^(1*)(0*)$/);
    if (!match) throw new Error('Invalid subnet mask (1-bits must be contiguous)');
    return match[1].length;
  }

  function wildcardFromMask(mask) {
    return (~mask) >>> 0;
  }

  // ------- Subnet sınıfları (IP class detection) -------

  function ipClass(num) {
    const firstOctet = (num >>> 24) & 0xFF;
    if (firstOctet < 128) return 'A';
    if (firstOctet < 192) return 'B';
    if (firstOctet < 224) return 'C';
    if (firstOctet < 240) return 'D (Multicast)';
    return 'E (Reserved)';
  }

  function ipType(num) {
    const o1 = (num >>> 24) & 0xFF;
    const o2 = (num >>> 16) & 0xFF;

    // Loopback
    if (o1 === 127) return 'Loopback';
    // Private (RFC 1918)
    if (o1 === 10) return 'Private (RFC 1918)';
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return 'Private (RFC 1918)';
    if (o1 === 192 && o2 === 168) return 'Private (RFC 1918)';
    // Link-local (APIPA)
    if (o1 === 169 && o2 === 254) return 'Link-local (APIPA)';
    // CGNAT
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return 'CGNAT (RFC 6598)';
    // Multicast
    if (o1 >= 224 && o1 <= 239) return 'Multicast';
    // Reserved
    if (o1 >= 240) return 'Reserved';
    // Documentation
    if ((o1 === 192 && o2 === 0 && ((num >>> 8) & 0xFF) === 2) ||
        (o1 === 198 && o2 === 51) ||
        (o1 === 203 && o2 === 0)) return 'Documentation (RFC 5737)';
    return 'Public';
  }

  // ------- Ana subnet hesaplama -------

  function calculate(ip, cidr) {
    const ipNum = ipToInt(ip);
    cidr = Number(cidr);
    if (!Number.isInteger(cidr) || cidr < 0 || cidr > 32) {
      throw new Error('CIDR must be an integer between 0 and 32');
    }

    const mask = cidrToMask(cidr);
    const wildcard = wildcardFromMask(mask);
    const network = (ipNum & mask) >>> 0;
    const broadcast = (network | wildcard) >>> 0;
    const totalAddresses = cidr === 32 ? 1 : Math.pow(2, 32 - cidr);

    let firstHost, lastHost, usableHosts;

    if (cidr === 32) {
      // /32 = host route
      firstHost = network;
      lastHost = network;
      usableHosts = 1;
    } else if (cidr === 31) {
      // /31 = point-to-point (RFC 3021), her iki adres kullanılabilir
      firstHost = network;
      lastHost = broadcast;
      usableHosts = 2;
    } else {
      firstHost = (network + 1) >>> 0;
      lastHost = (broadcast - 1) >>> 0;
      usableHosts = totalAddresses - 2;
    }

    return {
      input: { ip, cidr },
      ip: {
        decimal: intToIp(ipNum),
        binary: intToBinary(ipNum),
        hex: intToHex(ipNum),
        int: ipNum
      },
      cidr,
      mask: {
        decimal: intToIp(mask),
        binary: intToBinary(mask),
        hex: intToHex(mask),
        int: mask
      },
      wildcard: {
        decimal: intToIp(wildcard),
        binary: intToBinary(wildcard),
        hex: intToHex(wildcard)
      },
      network: {
        decimal: intToIp(network),
        binary: intToBinary(network),
        hex: intToHex(network),
        int: network,
        cidrNotation: `${intToIp(network)}/${cidr}`
      },
      broadcast: {
        decimal: intToIp(broadcast),
        binary: intToBinary(broadcast),
        hex: intToHex(broadcast),
        int: broadcast
      },
      firstHost: {
        decimal: intToIp(firstHost),
        int: firstHost
      },
      lastHost: {
        decimal: intToIp(lastHost),
        int: lastHost
      },
      counts: {
        total: totalAddresses,
        usable: usableHosts
      },
      meta: {
        class: ipClass(ipNum),
        type: ipType(ipNum),
        isPointToPoint: cidr === 31,
        isHostRoute: cidr === 32,
        isDefaultRoute: cidr === 0
      }
    };
  }

  // ------- VLSM hesaplama -------
  /**
   * VLSM: parent network'ü, host gereksinimi listesine göre alt subnetlere böler.
   * requirements: [{name: 'LAN-A', hosts: 50}, ...]
   * Büyükten küçüğe sıralayıp ardışık olarak yerleştirir.
   */
  function vlsm(parentIp, parentCidr, requirements) {
    const parent = calculate(parentIp, parentCidr);
    const parentNetwork = parent.network.int;
    const parentBroadcast = parent.broadcast.int;

    // Sırala ama orijinal index'i koru
    const sorted = requirements
      .map((r, i) => ({ ...r, _origIndex: i }))
      .sort((a, b) => b.hosts - a.hosts);

    const results = [];
    let cursor = parentNetwork;

    for (const req of sorted) {
      if (req.hosts < 1) {
        results.push({ ...req, error: 'Host count must be at least 1' });
        continue;
      }

      // Gerekli prefix uzunluğunu bul
      // /31 ve /32 özel; standart subnetler için: 2^(32-cidr) - 2 >= hosts
      let neededCidr = 32;
      for (let c = 30; c >= 0; c--) {
        const usable = (c === 31) ? 2 : Math.pow(2, 32 - c) - 2;
        if (usable >= req.hosts) {
          neededCidr = c;
          break;
        }
      }
      // Eğer host=1 ve cidr=30 yeterli geliyorsa kalsın; ama /32 talebi için ayrı kontrol
      if (req.hosts === 1 && neededCidr === 30) {
        // /30 4 adresten 2'si kullanılabilir, host=1 için yeterli
      }

      const blockSize = Math.pow(2, 32 - neededCidr);

      // cursor'ı block boundary'sine hizala
      const aligned = Math.ceil(cursor / blockSize) * blockSize;

      if (aligned + blockSize - 1 > parentBroadcast) {
        results.push({
          ...req,
          error: 'No space remaining in parent network'
        });
        continue;
      }

      const subnetCalc = calculate(intToIp(aligned >>> 0), neededCidr);
      results.push({
        name: req.name,
        requestedHosts: req.hosts,
        cidr: neededCidr,
        ...subnetCalc,
        _origIndex: req._origIndex
      });

      cursor = aligned + blockSize;
    }

    // Orijinal sıraya geri al
    results.sort((a, b) => (a._origIndex ?? 0) - (b._origIndex ?? 0));

    const usedAddresses = results
      .filter(r => !r.error)
      .reduce((sum, r) => sum + r.counts.total, 0);

    return {
      parent,
      subnets: results,
      summary: {
        totalRequested: requirements.length,
        successful: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length,
        addressesUsed: usedAddresses,
        addressesAvailable: parent.counts.total,
        utilizationPercent: ((usedAddresses / parent.counts.total) * 100).toFixed(2)
      }
    };
  }

  // ------- Supernetting / Summarization -------
  /**
   * Verilen network listesinin en küçük ortak supernet'ini bulur.
   * Tüm network'lerin kapsanması garantidir.
   */
  function summarize(networks) {
    if (!networks || networks.length === 0) {
      throw new Error('At least one network required');
    }

    // Her bir input'u {ip, cidr} olarak parse et
    const parsed = networks.map(n => {
      if (typeof n === 'string') {
        const [ip, cidrStr] = n.split('/');
        return { ip: ip.trim(), cidr: Number(cidrStr) };
      }
      return n;
    });

    // Her network'ün başlangıç ve bitiş int'ini hesapla
    const ranges = parsed.map(n => {
      const c = calculate(n.ip, n.cidr);
      return { start: c.network.int, end: c.broadcast.int };
    });

    const minStart = Math.min(...ranges.map(r => r.start)) >>> 0;
    const maxEnd = Math.max(...ranges.map(r => r.end)) >>> 0;

    // En küçük ortak prefix'i bul: start ve end'in ortak yüksek bitleri
    let commonCidr = 32;
    for (let c = 0; c <= 32; c++) {
      const m = c === 0 ? 0 : (0xFFFFFFFF << (32 - c)) >>> 0;
      if (((minStart & m) >>> 0) === ((maxEnd & m) >>> 0)) {
        commonCidr = c;
      } else {
        break;
      }
    }

    const supernet = calculate(intToIp(minStart & cidrToMask(commonCidr)), commonCidr);

    return {
      inputs: parsed.map(p => calculate(p.ip, p.cidr)),
      supernet,
      savings: {
        originalCount: networks.length,
        addressesCovered: supernet.counts.total
      }
    };
  }

  // ------- Range içinde mi? -------
  function contains(network, cidr, testIp) {
    const c = calculate(network, cidr);
    const t = ipToInt(testIp);
    return t >= c.network.int && t <= c.broadcast.int;
  }

  // ------- /N için subnet listesi (parent'ı eşit alt subnetlere böl) -------
  function splitInto(parentIp, parentCidr, newCidr, maxResults = 256) {
    if (newCidr <= parentCidr) throw new Error('New CIDR must be larger than parent');
    if (newCidr > 32) throw new Error('CIDR maximum is 32');

    const parent = calculate(parentIp, parentCidr);
    const blockSize = Math.pow(2, 32 - newCidr);
    const totalSubnets = Math.pow(2, newCidr - parentCidr);

    const subnets = [];
    const limit = Math.min(totalSubnets, maxResults);
    for (let i = 0; i < limit; i++) {
      const subnetIp = intToIp((parent.network.int + i * blockSize) >>> 0);
      subnets.push(calculate(subnetIp, newCidr));
    }

    return {
      parent,
      newCidr,
      totalSubnets,
      shown: limit,
      truncated: totalSubnets > limit,
      subnets
    };
  }

  return {
    ipToInt, intToIp, intToBinary, intToHex,
    cidrToMask, maskToCidr, wildcardFromMask,
    ipClass, ipType,
    calculate, vlsm, summarize, contains, splitInto
  };
})();

window.IPv4 = IPv4;
