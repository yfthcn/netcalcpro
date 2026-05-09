/**
 * NetCalc Pro - IPv6 Core Engine
 * BigInt kullanarak 128-bit aritmetik yapar.
 */

const IPv6 = (() => {

  const MAX_128 = (1n << 128n) - 1n;

  // Genişletilmiş forma çevir: 2001:db8::1 -> 2001:0db8:0000:0000:0000:0000:0000:0001
  function expand(addr) {
    if (typeof addr !== 'string') throw new Error('IPv6 must be a string');
    addr = addr.trim().toLowerCase();
    if (addr.length === 0) throw new Error('Empty IPv6 address');

    const dcCount = (addr.match(/::/g) || []).length;
    if (dcCount > 1) throw new Error('IPv6 "::" can only appear once');

    let parts;
    if (dcCount === 1) {
      const [left, right] = addr.split('::');
      const leftParts = left ? left.split(':') : [];
      const rightParts = right ? right.split(':') : [];
      const missing = 8 - leftParts.length - rightParts.length;
      if (missing < 0) throw new Error('IPv6 address too long');
      parts = [...leftParts, ...Array(missing).fill('0'), ...rightParts];
    } else {
      parts = addr.split(':');
    }

    if (parts.length !== 8) {
      throw new Error(`IPv6 must contain 8 groups (${parts.length} found)`);
    }

    return parts.map(p => {
      if (!/^[0-9a-f]{1,4}$/.test(p)) {
        throw new Error(`Invalid IPv6 group: "${p}"`);
      }
      return p.padStart(4, '0');
    }).join(':');
  }

  // RFC 5952 uyumlu sıkıştırma
  function compress(addr) {
    const expanded = expand(addr);
    const groups = expanded.split(':').map(g => g.replace(/^0+/, '') || '0');

    // En uzun ardışık 0 grubunu bul (en az 2 olmalı)
    let bestStart = -1, bestLen = 0;
    let curStart = -1, curLen = 0;
    for (let i = 0; i < groups.length; i++) {
      if (groups[i] === '0') {
        if (curStart === -1) curStart = i;
        curLen++;
        if (curLen > bestLen) {
          bestStart = curStart;
          bestLen = curLen;
        }
      } else {
        curStart = -1;
        curLen = 0;
      }
    }

    if (bestLen >= 2) {
      const before = groups.slice(0, bestStart).join(':');
      const after = groups.slice(bestStart + bestLen).join(':');
      return `${before}::${after}`;
    }
    return groups.join(':');
  }

  function ipToBigInt(addr) {
    const expanded = expand(addr);
    const hex = expanded.replace(/:/g, '');
    return BigInt('0x' + hex);
  }

  function bigIntToIp(num) {
    if (num < 0n || num > MAX_128) throw new Error('IPv6 out of range');
    const hex = num.toString(16).padStart(32, '0');
    const groups = [];
    for (let i = 0; i < 32; i += 4) {
      groups.push(hex.substr(i, 4));
    }
    return groups.join(':');
  }

  function prefixToMask(prefix) {
    if (prefix < 0 || prefix > 128) throw new Error('Prefix must be between 0 and 128');
    if (prefix === 0) return 0n;
    return ((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix);
  }

  function ipType(num) {
    // Loopback ::1
    if (num === 1n) return 'Loopback (::1)';
    // Unspecified ::
    if (num === 0n) return 'Unspecified (::)';

    const expanded = bigIntToIp(num);
    const firstGroup = parseInt(expanded.substr(0, 4), 16);
    const first16 = firstGroup;
    const first8 = (firstGroup >> 8) & 0xFF;

    // Multicast: ff00::/8
    if (first8 === 0xff) return 'Multicast (ff00::/8)';
    // Link-local: fe80::/10
    if ((firstGroup & 0xffc0) === 0xfe80) return 'Link-local (fe80::/10)';
    // ULA: fc00::/7
    if ((first8 & 0xfe) === 0xfc) return 'Unique Local (fc00::/7)';
    // Documentation: 2001:db8::/32
    const second = parseInt(expanded.substr(5, 4), 16);
    if (firstGroup === 0x2001 && second === 0x0db8) return 'Documentation (2001:db8::/32)';
    // 6to4: 2002::/16
    if (firstGroup === 0x2002) return '6to4 (2002::/16)';
    // Teredo: 2001::/32
    if (firstGroup === 0x2001 && second === 0x0000) return 'Teredo (2001::/32)';
    // GUA: 2000::/3
    if ((firstGroup & 0xe000) === 0x2000) return 'Global Unicast (2000::/3)';

    return 'Reserved/Other';
  }

  function calculate(addr, prefix) {
    const num = ipToBigInt(addr);
    prefix = Number(prefix);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) {
      throw new Error('Prefix must be 0-128');
    }

    const mask = prefixToMask(prefix);
    const network = num & mask;
    // IPv6'da broadcast yok ama "son adres" hesabı yararlı
    const lastAddr = network | ((1n << BigInt(128 - prefix)) - 1n);
    const totalAddresses = 1n << BigInt(128 - prefix);

    return {
      input: { addr, prefix },
      address: {
        full: bigIntToIp(num),
        compressed: compress(bigIntToIp(num)),
        bigInt: num.toString()
      },
      prefix,
      network: {
        full: bigIntToIp(network),
        compressed: compress(bigIntToIp(network)),
        cidrNotation: `${compress(bigIntToIp(network))}/${prefix}`
      },
      lastAddress: {
        full: bigIntToIp(lastAddr),
        compressed: compress(bigIntToIp(lastAddr))
      },
      mask: {
        full: bigIntToIp(mask),
        compressed: compress(bigIntToIp(mask))
      },
      counts: {
        total: totalAddresses.toString(),
        // Okunabilir formatta gösterim için
        totalReadable: formatBigCount(totalAddresses)
      },
      meta: {
        type: ipType(num),
        isHostRoute: prefix === 128
      }
    };
  }

  function formatBigCount(n) {
    const str = n.toString();
    if (str.length <= 6) return str;
    // 2^N olarak göster
    const log2 = str.length === 1 ? 0 : Math.floor((str.length - 1) * Math.log2(10));
    // Yaklaşık 2^? bul
    let exp = 0;
    let v = n;
    while (v > 1n) { v >>= 1n; exp++; }
    return `2^${exp} (${str.length > 20 ? str.slice(0, 6) + '…' + str.slice(-3) : str})`;
  }

  return {
    expand, compress,
    ipToBigInt, bigIntToIp,
    prefixToMask, ipType,
    calculate
  };
})();

window.IPv6 = IPv6;
