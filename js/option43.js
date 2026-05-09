/**
 * NetCalc Pro - DHCP Option 43 Generator
 * Cisco WLC ve Ruckus için TLV hex string üretir.
 * Cisco için Wi-Fi 7 Universal AP'lerde Fast Offline Migration (FOM) desteği vardır.
 */
const Option43 = (() => {

  function ipToHexBytes(ip) {
    const num = IPv4.ipToInt(ip);
    return [
      ((num >>> 24) & 0xFF).toString(16).padStart(2, '0'),
      ((num >>> 16) & 0xFF).toString(16).padStart(2, '0'),
      ((num >>>  8) & 0xFF).toString(16).padStart(2, '0'),
      ( num         & 0xFF).toString(16).padStart(2, '0')
    ];
  }

  const VENDOR_TYPES = {
    cisco:      { code: 'f1', name: 'Cisco WLC / Catalyst' },
    ruckus_zd:  { code: '06', name: 'Ruckus ZoneDirector' },
    ruckus_scg: { code: '03', name: 'Ruckus SmartZone' }
  };

  function generate(vendor, ipList, options = {}) {
    if (!ipList || ipList.length === 0) {
      throw new Error('At least one controller IP required');
    }
    if (ipList.length > 16) {
      throw new Error('Too many IPs (max 16)');
    }
    const v = VENDOR_TYPES[vendor];
    if (!v) throw new Error('Invalid vendor');

    const isFom = options.fom === true && vendor === 'cisco';
    const fomMode = options.fomMode === 'meraki' ? '01' : '02';

    const type = isFom ? 'f3' : v.code;
    const length = isFom
      ? ((ipList.length * 4) + 1).toString(16).padStart(2, '0')
      : (ipList.length * 4).toString(16).padStart(2, '0');

    const allBytes = [];
    for (const ip of ipList) allBytes.push(...ipToHexBytes(ip));

    const flatHex = type + length + allBytes.join('') + (isFom ? fomMode : '');

    const formats = {
      spaced:    flatHex.match(/.{2}/g).join(' '),
      colon:     flatHex.match(/.{2}/g).join(':'),
      ciscoDot:  flatHex.match(/.{4}/g).join('.'),
      ciscoFlat: flatHex,
      raw:       flatHex,
      bracketed: '[' + flatHex.toUpperCase() + ']'
    };

    return {
      vendor, vendorName: v.name, ipList,
      type, length, valueBytes: allBytes,
      fom: isFom,
      fomMode: isFom ? (options.fomMode === 'meraki' ? 'Meraki' : 'Catalyst') : null,
      fomModeByte: isFom ? fomMode : null,
      formats,
      breakdown: ipList.map(ip => ({
        ip,
        hex: ipToHexBytes(ip).join(' '),
        explanation: ipToHexBytes(ip).map((h, i) =>
          `${ip.split('.')[i]} → ${h}`).join(', ')
      })),
      cliCommands: buildCliCommands(vendor, ipList, flatHex, isFom)
    };
  }

  function buildCliCommands(vendor, ipList, flatHex, isFom = false) {
    const dotted = flatHex.match(/.{4}/g).join('.');
    const colon  = flatHex.match(/.{2}/g).join(':');
    const upper  = flatHex.toUpperCase().match(/.{2}/g).join(' ');

    if (vendor === 'cisco') {
      const flat = flatHex;
      const fomNote = isFom ? ' [FOM]' : '';
      const cmds = [
        {
          label: `Cisco IOS DHCP Pool — flat hex${fomNote}`,
          code: `ip dhcp pool AP-VLAN\n network <SUBNET> <MASK>\n default-router <GATEWAY>\n option 43 hex ${flat}`
        },
        {
          label: `Cisco IOS DHCP Pool — dotted hex${fomNote}`,
          code: `ip dhcp pool AP-VLAN\n option 43 hex ${dotted}`
        }
      ];
      if (ipList.length === 1 && !isFom) {
        cmds.push({
          label: 'Cisco IOS — ASCII Alternative (single WLC, classic only)',
          code: `ip dhcp pool AP-VLAN\n option 43 ascii "${ipList[0]}"`
        });
      }
      cmds.push({
        label: 'Microsoft DHCP Server (Vendor Specific Info)',
        code: `Option 043 = ${upper}`
      });
      return cmds;
    }
    return [
      {
        label: 'Cisco IOS DHCP Pool',
        code: `ip dhcp pool AP-VLAN\n option 43 hex ${dotted}`
      },
      {
        label: 'Microsoft DHCP / Generic',
        code: `Option 043 = ${colon}`
      }
    ];
  }

  function decode(hexString) {
    const clean = hexString.replace(/[\s\-:.\[\]]/g, '').toLowerCase();
    if (!/^[0-9a-f]+$/.test(clean)) throw new Error('Invalid hex character');
    if (clean.length < 4) throw new Error('Hex too short');

    const type = clean.substr(0, 2);
    const length = parseInt(clean.substr(2, 2), 16);
    const value = clean.substr(4);

    if (value.length !== length * 2) {
      throw new Error(`Length mismatch: ${length} bytes expected, ${value.length / 2} found`);
    }

    const isFom = type === 'f3';
    const ips = [];
    let actualIpCount;
    let fomMode = null;

    if (isFom) {
      if ((length - 1) % 4 !== 0) {
        throw new Error('Invalid FOM length (must be ip×4+1)');
      }
      actualIpCount = (length - 1) / 4;
      for (let i = 0; i < actualIpCount; i++) {
        const slice = value.substr(i * 8, 8);
        ips.push(slice.match(/.{2}/g).map(h => parseInt(h, 16)).join('.'));
      }
      const modeByte = value.substr(value.length - 2);
      fomMode = modeByte === '01' ? 'Meraki' : modeByte === '02' ? 'Catalyst' : `Unknown (0x${modeByte})`;
    } else {
      if (length % 4 !== 0) throw new Error('Length must be a multiple of 4');
      actualIpCount = length / 4;
      for (let i = 0; i < actualIpCount; i++) {
        const slice = value.substr(i * 8, 8);
        ips.push(slice.match(/.{2}/g).map(h => parseInt(h, 16)).join('.'));
      }
    }

    const vendorMap = {
      f1: 'Cisco WLC (classic)',
      f3: 'Cisco WLC (FOM — Wi-Fi 7)',
      '06': 'Ruckus ZoneDirector',
      '03': 'Ruckus SmartZone'
    };

    return {
      type, length,
      ipCount: actualIpCount,
      ips,
      vendor: vendorMap[type] || `Unknown (0x${type})`,
      fom: isFom,
      fomMode
    };
  }

  return { generate, decode, ipToHexBytes, VENDOR_TYPES };
})();

window.Option43 = Option43;
