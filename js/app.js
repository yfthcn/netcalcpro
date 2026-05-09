/**
 * NetCalc Pro - Tab Controllers
 */

// ===========================================================
// TAB: SUBNET CALCULATOR (IPv4 ana hesaplama)
// ===========================================================
const SubnetTab = {
  init() {
    const ipInput = UI.$('#subnet-ip');
    const cidrInput = UI.$('#subnet-cidr');
    const maskSelect = UI.$('#subnet-mask-quick');
    const out = UI.$('#subnet-output');

    // IP içine /24 yazılırsa CIDR'a aktar
    ipInput.addEventListener('input', () => {
      const v = ipInput.value;
      if (v.includes('/')) {
        const [ip, cidr] = v.split('/');
        ipInput.value = ip.trim();
        if (cidr) cidrInput.value = cidr.trim();
      }
    });

    // Hızlı mask seçimi
    maskSelect.addEventListener('change', () => {
      if (maskSelect.value) cidrInput.value = maskSelect.value;
    });

    const run = () => {
      UI.showError('subnet-error', '');
      out.innerHTML = '';
      try {
        const result = IPv4.calculate(ipInput.value.trim(), cidrInput.value);
        SubnetTab.render(result, out);
        if (window.innerWidth <= 640) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {
        UI.showError('subnet-error', '⚠ ' + e.message);
      }
    };

    UI.$('#subnet-form').addEventListener('submit', e => {
      e.preventDefault();
      run();
    });

    // İlk yüklemede default örnek
    ipInput.value = '192.168.1.100';
    cidrInput.value = '24';
    run();
  },

  render(r, container) {
    // Üst kart grid'i
    const grid = document.createElement('div');
    grid.className = 'result-grid';
    grid.appendChild(UI.card({
      title: 'Network',
      value: r.network.cidrNotation,
      sub: `${UI.formatNumber(r.counts.usable)} usable hosts`,
      large: true
    }));
    grid.appendChild(UI.card({
      title: 'Broadcast',
      value: r.broadcast.decimal,
      sub: 'End of subnet'
    }));
    grid.appendChild(UI.card({
      title: 'Host Range',
      value: `${r.firstHost.decimal} – ${r.lastHost.decimal}`,
      sub: r.meta.isPointToPoint ? 'RFC 3021 P2P' : (r.meta.isHostRoute ? 'Host route' : 'First – Last host'),
    }));
    grid.appendChild(UI.card({
      title: 'Subnet Mask',
      value: r.mask.decimal,
      sub: r.wildcard.decimal + ' (wildcard)'
    }));
    container.appendChild(grid);

    // Adres detay
    container.appendChild(UI.detailSection('Address Details', [
      UI.detailRow('Input IP', r.ip.decimal, { copy: true }),
      UI.detailRow('CIDR', `/${r.cidr}`),
      UI.detailRow('Class', r.meta.class),
      UI.detailRow('Type', r.meta.type),
      UI.detailRow('Hex', r.ip.hex, { copy: true }),
      UI.detailRow('Integer', String(r.ip.int))
    ]));

    // Network detay
    container.appendChild(UI.detailSection('Network Block', [
      UI.detailRow('Network Address', r.network.decimal, { copy: true }),
      UI.detailRow('Broadcast Address', r.broadcast.decimal, { copy: true }),
      UI.detailRow('First Host', r.firstHost.decimal, { copy: true }),
      UI.detailRow('Last Host', r.lastHost.decimal, { copy: true }),
      UI.detailRow('Total Addresses', UI.formatNumber(r.counts.total)),
      UI.detailRow('Usable Hosts', UI.formatNumber(r.counts.usable))
    ]));

    // Mask detay
    container.appendChild(UI.detailSection('Mask & Wildcard', [
      UI.detailRow('Subnet Mask', r.mask.decimal, { copy: true }),
      UI.detailRow('Mask Hex', r.mask.hex, { copy: true }),
      UI.detailRow('Wildcard (ACL)', r.wildcard.decimal, { copy: true }),
      UI.detailRow('Mask Binary', r.mask.binary)
    ]));

    // Binary görünüm — network bitleri vurgulu
    const binSec = document.createElement('div');
    binSec.className = 'detail-section';
    const binHdr = document.createElement('div');
    binHdr.className = 'detail-header';
    binHdr.textContent = 'Binary Representation';
    binSec.appendChild(binHdr);

    const binGrid = document.createElement('div');
    binGrid.className = 'detail-rows';

    const addBin = (label, decimal, binStr) => {
      const lbl = document.createElement('div');
      lbl.textContent = label;
      const val = document.createElement('div');
      val.appendChild(UI.renderBinaryHighlighted(binStr, r.cidr));
      const dec = document.createElement('div');
      dec.style.fontSize = '11px';
      dec.style.color = 'var(--text-tertiary)';
      dec.style.marginTop = '4px';
      dec.textContent = decimal;
      val.appendChild(dec);
      binGrid.appendChild(lbl);
      binGrid.appendChild(val);
    };

    addBin('IP', r.ip.decimal, r.ip.binary);
    addBin('Mask', r.mask.decimal, r.mask.binary);
    addBin('Network', r.network.decimal, r.network.binary);
    addBin('Broadcast', r.broadcast.decimal, r.broadcast.binary);

    binSec.appendChild(binGrid);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'legend-row';
    legend.innerHTML = `
      <span><span style="color:var(--bit-network);font-weight:700;">█</span> <span style="color:var(--text-tertiary);">Network bits (${r.cidr})</span></span>
      <span><span style="color:var(--bit-host);">█</span> <span style="color:var(--text-tertiary);">Host bits (${32 - r.cidr})</span></span>
    `;
    binSec.appendChild(legend);
    container.appendChild(binSec);

    // Cisco config snippet
    const cisco = document.createElement('div');
    cisco.className = 'detail-section';
    cisco.appendChild(Object.assign(document.createElement('div'), {
      className: 'detail-header',
      textContent: 'Cisco IOS Snippet'
    }));
    const code = document.createElement('pre');
    code.className = 'code-block';
    code.textContent = `! Interface configuration\ninterface GigabitEthernet0/1\n ip address ${r.ip.decimal} ${r.mask.decimal}\n no shutdown\n!\n! Network statement (OSPF/EIGRP)\nnetwork ${r.network.decimal} ${r.wildcard.decimal}\n!\n! Static route example\nip route ${r.network.decimal} ${r.mask.decimal} <next-hop>`;
    cisco.appendChild(code);
    container.appendChild(cisco);
  }
};

// ===========================================================
// TAB: VLSM
// ===========================================================
const VlsmTab = {
  rowCounter: 0,
  init() {
    UI.$('#vlsm-add-btn').addEventListener('click', () => VlsmTab.addRow());
    UI.$('#vlsm-form').addEventListener('submit', e => {
      e.preventDefault();
      VlsmTab.calculate();
    });

    UI.$('#vlsm-parent-ip').value = '192.168.10.0';
    UI.$('#vlsm-parent-cidr').value = '24';

    // Default 3 satır
    VlsmTab.addRow('LAN-A', 60);
    VlsmTab.addRow('LAN-B', 28);
    VlsmTab.addRow('WAN-Link', 2);
    VlsmTab.calculate();
  },

  addRow(name = '', hosts = '') {
    VlsmTab.rowCounter++;
    const row = document.createElement('div');
    row.className = 'vlsm-row';
    row.innerHTML = `
      <input type="text" class="input vlsm-name" placeholder="Subnet name (e.g. LAN-A)" value="${name}">
      <input type="number" min="1" class="input vlsm-hosts" placeholder="Host count" value="${hosts}">
      <button class="btn btn-danger" type="button" title="Remove">×</button>
    `;
    row.querySelector('.btn-danger').addEventListener('click', () => row.remove());
    UI.$('#vlsm-requirements').appendChild(row);
  },

  calculate() {
    UI.showError('vlsm-error', '');
    const out = UI.$('#vlsm-output');
    out.innerHTML = '';
    try {
      const parentIp = UI.$('#vlsm-parent-ip').value.trim();
      const parentCidr = UI.$('#vlsm-parent-cidr').value;

      const reqs = UI.$$('.vlsm-row').map(row => {
        const name = row.querySelector('.vlsm-name').value.trim() || `Subnet`;
        const hosts = parseInt(row.querySelector('.vlsm-hosts').value, 10);
        return { name, hosts };
      }).filter(r => !isNaN(r.hosts) && r.hosts > 0);

      if (reqs.length === 0) {
        throw new Error('Enter at least one subnet requirement');
      }

      const result = IPv4.vlsm(parentIp, parentCidr, reqs);
      VlsmTab.render(result, out);
      if (window.innerWidth <= 640) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      UI.showError('vlsm-error', '⚠ ' + e.message);
    }
  },

  render(result, container) {
    // Özet
    const sum = document.createElement('div');
    sum.className = 'summary-bar';
    sum.innerHTML = `
      <div class="summary-stat"><span class="label">Parent</span><span class="value accent">${result.parent.network.cidrNotation}</span></div>
      <div class="summary-stat"><span class="label">Total Addresses</span><span class="value">${UI.formatNumber(result.parent.counts.total)}</span></div>
      <div class="summary-stat"><span class="label">Subnets</span><span class="value">${result.summary.successful}/${result.summary.totalRequested}</span></div>
      <div class="summary-stat"><span class="label">Used</span><span class="value">${UI.formatNumber(result.summary.addressesUsed)}</span></div>
      <div class="summary-stat"><span class="label">Utilization</span><span class="value accent">${result.summary.utilizationPercent}%</span></div>
    `;
    container.appendChild(sum);

    // Sonuç tablosu
    const table = document.createElement('table');
    table.className = 'results-table';
    table.innerHTML = `
      <thead><tr>
        <th>Name</th><th>Requested</th><th>CIDR</th><th>Network</th><th>Broadcast</th>
        <th>Host Range</th><th>Mask</th><th>Total</th>
      </tr></thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    for (const sn of result.subnets) {
      const tr = document.createElement('tr');
      if (sn.error) {
        tr.className = 'row-error';
        tr.innerHTML = `<td>${sn.name}</td><td>${sn.hosts}</td><td colspan="6">⚠ ${sn.error}</td>`;
      } else {
        tr.innerHTML = `
          <td><strong>${sn.name}</strong></td>
          <td>${sn.requestedHosts}</td>
          <td><span class="cidr-pill">/${sn.cidr}</span></td>
          <td>${sn.network.decimal}</td>
          <td>${sn.broadcast.decimal}</td>
          <td>${sn.firstHost.decimal} – ${sn.lastHost.decimal}</td>
          <td>${sn.mask.decimal}</td>
          <td>${UI.formatNumber(sn.counts.usable)}</td>
        `;
      }
      tbody.appendChild(tr);
    }
    container.appendChild(table);
  }
};

// ===========================================================
// TAB: SUPERNET / SUMMARIZATION
// ===========================================================
const SupernetTab = {
  init() {
    UI.$('#supernet-form').addEventListener('submit', e => {
      e.preventDefault();
      SupernetTab.calculate();
    });
    UI.$('#supernet-input').value =
      '192.168.0.0/24\n192.168.1.0/24\n192.168.2.0/24\n192.168.3.0/24';
    SupernetTab.calculate();
  },

  calculate() {
    UI.showError('supernet-error', '');
    const out = UI.$('#supernet-output');
    out.innerHTML = '';
    try {
      const lines = UI.$('#supernet-input').value
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      if (lines.length === 0) throw new Error('Enter at least one network');
      for (const l of lines) {
        if (!l.includes('/')) throw new Error(`CIDR notation required: "${l}"`);
      }

      const result = IPv4.summarize(lines);
      SupernetTab.render(result, out);
      if (window.innerWidth <= 640) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      UI.showError('supernet-error', '⚠ ' + e.message);
    }
  },

  render(result, container) {
    const sup = result.supernet;

    const grid = document.createElement('div');
    grid.className = 'result-grid';
    grid.appendChild(UI.card({
      title: 'Summary Route',
      value: sup.network.cidrNotation,
      sub: `covers ${UI.formatNumber(sup.counts.total)} addresses`,
      large: true
    }));
    grid.appendChild(UI.card({
      title: 'Mask',
      value: sup.mask.decimal,
      sub: `wildcard: ${sup.wildcard.decimal}`
    }));
    grid.appendChild(UI.card({
      title: 'Range',
      value: `${sup.network.decimal} – ${sup.broadcast.decimal}`,
      sub: 'Network → Broadcast'
    }));
    container.appendChild(grid);

    // Input network listesi
    const table = document.createElement('table');
    table.className = 'results-table';
    table.innerHTML = `
      <thead><tr>
        <th>#</th><th>Network</th><th>CIDR</th><th>Range</th><th>Addresses</th>
      </tr></thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    result.inputs.forEach((inp, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td><strong>${inp.network.decimal}</strong></td>
        <td><span class="cidr-pill">/${inp.cidr}</span></td>
        <td>${inp.network.decimal} – ${inp.broadcast.decimal}</td>
        <td>${UI.formatNumber(inp.counts.total)}</td>
      `;
      tbody.appendChild(tr);
    });
    container.appendChild(table);

    // Cisco snippet
    const cisco = document.createElement('div');
    cisco.className = 'detail-section';
    cisco.appendChild(Object.assign(document.createElement('div'), {
      className: 'detail-header',
      textContent: 'Cisco Route Summary'
    }));
    const code = document.createElement('pre');
    code.className = 'code-block';
    code.textContent = `! EIGRP/OSPF area summarization\nip summary-address eigrp <ASN> ${sup.network.decimal} ${sup.mask.decimal}\n! OSPF inter-area\narea <id> range ${sup.network.decimal} ${sup.mask.decimal}\n! BGP aggregate\naggregate-address ${sup.network.decimal} ${sup.mask.decimal} summary-only`;
    cisco.appendChild(code);
    container.appendChild(cisco);
  }
};

// ===========================================================
// TAB: WILDCARD MASK
// ===========================================================
const WildcardTab = {
  init() {
    UI.$('#wildcard-form').addEventListener('submit', e => {
      e.preventDefault();
      WildcardTab.calculate();
    });
    UI.$('#wildcard-ip').value = '10.0.0.0';
    UI.$('#wildcard-cidr').value = '24';
    WildcardTab.calculate();
  },

  calculate() {
    UI.showError('wildcard-error', '');
    const out = UI.$('#wildcard-output');
    out.innerHTML = '';
    try {
      const result = IPv4.calculate(UI.$('#wildcard-ip').value.trim(), UI.$('#wildcard-cidr').value);
      WildcardTab.render(result, out);
      if (window.innerWidth <= 640) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      UI.showError('wildcard-error', '⚠ ' + e.message);
    }
  },

  render(r, container) {
    const grid = document.createElement('div');
    grid.className = 'result-grid';
    grid.appendChild(UI.card({
      title: 'Wildcard Mask',
      value: r.wildcard.decimal,
      sub: `binary: ${r.wildcard.binary}`,
      large: true
    }));
    grid.appendChild(UI.card({
      title: 'Subnet Mask',
      value: r.mask.decimal,
      sub: r.mask.binary
    }));
    grid.appendChild(UI.card({
      title: 'Network',
      value: r.network.cidrNotation,
      sub: `${UI.formatNumber(r.counts.total)} adres`
    }));
    container.appendChild(grid);

    container.appendChild(UI.detailSection('ACL Reference', [
      UI.detailRow('Network', r.network.decimal, { copy: true }),
      UI.detailRow('Wildcard', r.wildcard.decimal, { copy: true }),
      UI.detailRow('CIDR', `/${r.cidr}`),
      UI.detailRow('Wildcard Binary', r.wildcard.binary),
      UI.detailRow('Wildcard Hex', r.wildcard.hex, { copy: true })
    ]));

    // Cisco ACL örnekleri
    const acl = document.createElement('div');
    acl.className = 'detail-section';
    acl.appendChild(Object.assign(document.createElement('div'), {
      className: 'detail-header',
      textContent: 'Cisco ACL & OSPF Examples'
    }));
    const code = document.createElement('pre');
    code.className = 'code-block';
    code.textContent = `! Standard ACL\naccess-list 10 permit ${r.network.decimal} ${r.wildcard.decimal}\n!\n! Extended ACL\naccess-list 100 permit ip ${r.network.decimal} ${r.wildcard.decimal} any\n!\n! OSPF network statement\nrouter ospf 1\n network ${r.network.decimal} ${r.wildcard.decimal} area 0\n!\n! EIGRP network statement\nrouter eigrp 100\n network ${r.network.decimal} ${r.wildcard.decimal}`;
    acl.appendChild(code);
    container.appendChild(acl);

    // Tek host wildcard hatırlatması
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.style.padding = '12px 0';
    hint.innerHTML = `<strong>Tip:</strong> For a single host match, use <code>host ${r.ip.decimal}</code> or <code>${r.ip.decimal} 0.0.0.0</code>.`;
    container.appendChild(hint);
  }
};

// ===========================================================
// TAB: SPLIT (parent'ı eşit alt subnetlere böl)
// ===========================================================
const SplitTab = {
  init() {
    UI.$('#split-form').addEventListener('submit', e => {
      e.preventDefault();
      SplitTab.calculate();
    });
    UI.$('#split-ip').value = '192.168.0.0';
    UI.$('#split-parent-cidr').value = '24';
    UI.$('#split-new-cidr').value = '26';
    SplitTab.calculate();
  },

  calculate() {
    UI.showError('split-error', '');
    const out = UI.$('#split-output');
    out.innerHTML = '';
    try {
      const ip = UI.$('#split-ip').value.trim();
      const pc = parseInt(UI.$('#split-parent-cidr').value, 10);
      const nc = parseInt(UI.$('#split-new-cidr').value, 10);
      const result = IPv4.splitInto(ip, pc, nc, 1024);
      SplitTab.render(result, out);
      if (window.innerWidth <= 640) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      UI.showError('split-error', '⚠ ' + e.message);
    }
  },

  render(result, container) {
    const sum = document.createElement('div');
    sum.className = 'summary-bar';
    sum.innerHTML = `
      <div class="summary-stat"><span class="label">Parent</span><span class="value accent">${result.parent.network.cidrNotation}</span></div>
      <div class="summary-stat"><span class="label">New Prefix</span><span class="value">/${result.newCidr}</span></div>
      <div class="summary-stat"><span class="label">Total Subnets</span><span class="value">${UI.formatNumber(result.totalSubnets)}</span></div>
      <div class="summary-stat"><span class="label">Per-subnet host</span><span class="value">${UI.formatNumber(result.subnets[0]?.counts.usable ?? 0)}</span></div>
    `;
    container.appendChild(sum);

    if (result.truncated) {
      const warn = document.createElement('div');
      warn.className = 'hint warning-banner';
      warn.innerHTML = `⚠ Too many subnets (${UI.formatNumber(result.totalSubnets)}). Showing first ${result.shown}.`;
      container.appendChild(warn);
    }

    const table = document.createElement('table');
    table.className = 'results-table';
    table.innerHTML = `
      <thead><tr>
        <th>#</th><th>Network</th><th>Broadcast</th><th>First Host</th><th>Last Host</th><th>Mask</th>
      </tr></thead><tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    const frag = document.createDocumentFragment();
    result.subnets.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td><strong>${s.network.cidrNotation}</strong></td>
        <td>${s.broadcast.decimal}</td>
        <td>${s.firstHost.decimal}</td>
        <td>${s.lastHost.decimal}</td>
        <td>${s.mask.decimal}</td>
      `;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
    container.appendChild(table);
  }
};

// ===========================================================
// TAB: IPv6
// ===========================================================
const IPv6Tab = {
  init() {
    UI.$('#ipv6-form').addEventListener('submit', e => {
      e.preventDefault();
      IPv6Tab.calculate();
    });
    UI.$('#ipv6-addr').value = '2001:db8:abcd:1234::1';
    UI.$('#ipv6-prefix').value = '64';
    IPv6Tab.calculate();
  },

  calculate() {
    UI.showError('ipv6-error', '');
    const out = UI.$('#ipv6-output');
    out.innerHTML = '';
    try {
      const result = IPv6.calculate(UI.$('#ipv6-addr').value.trim(), UI.$('#ipv6-prefix').value);
      IPv6Tab.render(result, out);
      if (window.innerWidth <= 640) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      UI.showError('ipv6-error', '⚠ ' + e.message);
    }
  },

  render(r, container) {
    const grid = document.createElement('div');
    grid.className = 'result-grid';
    grid.appendChild(UI.card({
      title: 'Network',
      value: r.network.cidrNotation,
      sub: r.meta.type,
      large: true
    }));
    grid.appendChild(UI.card({
      title: 'Compressed',
      value: r.address.compressed,
      sub: 'RFC 5952 format'
    }));
    grid.appendChild(UI.card({
      title: 'Total Addresses',
      value: r.counts.totalReadable,
      sub: '128-bit space'
    }));
    container.appendChild(grid);

    container.appendChild(UI.detailSection('Address Forms', [
      UI.detailRow('Compressed', r.address.compressed, { copy: true }),
      UI.detailRow('Expanded', r.address.full, { copy: true }),
      UI.detailRow('Prefix Length', `/${r.prefix}`),
      UI.detailRow('Type', r.meta.type)
    ]));

    container.appendChild(UI.detailSection('Network Block', [
      UI.detailRow('Network (compressed)', r.network.compressed, { copy: true }),
      UI.detailRow('Network (expanded)', r.network.full, { copy: true }),
      UI.detailRow('Last Address', r.lastAddress.compressed, { copy: true }),
      UI.detailRow('Mask (expanded)', r.mask.full, { copy: true })
    ]));

    // Cisco IPv6 snippet
    const cisco = document.createElement('div');
    cisco.className = 'detail-section';
    cisco.appendChild(Object.assign(document.createElement('div'), {
      className: 'detail-header',
      textContent: 'Cisco IPv6 Snippet'
    }));
    const code = document.createElement('pre');
    code.className = 'code-block';
    code.textContent = `! Interface configuration\ninterface GigabitEthernet0/1\n ipv6 address ${r.address.compressed}/${r.prefix}\n no shutdown\n!\n! Static route\nipv6 route ${r.network.compressed}/${r.prefix} <next-hop>\n!\n! OSPFv3 / EIGRP for IPv6 enabled per-interface (no network statement)`;
    cisco.appendChild(code);
    container.appendChild(cisco);
  }
};

// ===========================================================
// TAB: OPTION 43
// ===========================================================
const Opt43Tab = {
  init() {
    UI.$$('#opt43-mode-toggle .mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        UI.$$('#opt43-mode-toggle .mode-btn').forEach(b =>
          b.classList.toggle('active', b === btn));
        const mode = btn.dataset.mode;
        UI.$('#opt43-encode').style.display = mode === 'encode' ? 'block' : 'none';
        UI.$('#opt43-decode').style.display = mode === 'decode' ? 'block' : 'none';
      });
    });

    UI.$('#opt43-encode-form').addEventListener('submit', e => {
      e.preventDefault();
      Opt43Tab.encode();
    });
    UI.$('#opt43-decode-form').addEventListener('submit', e => {
      e.preventDefault();
      Opt43Tab.decode();
    });

    UI.$('#opt43-ips').addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) Opt43Tab.encode();
    });

    UI.$('#opt43-fom-toggle').addEventListener('change', e => {
      UI.$('#opt43-fom-mode-wrap').style.display = e.target.checked ? 'flex' : 'none';
      Opt43Tab.encode();
    });
    UI.$$('input[name="fom-mode"]').forEach(r => {
      r.addEventListener('change', () => Opt43Tab.encode());
    });
    UI.$('#opt43-vendor').addEventListener('change', () => {
      const isCisco = UI.$('#opt43-vendor').value === 'cisco';
      UI.$('#opt43-fom-section').style.display = isCisco ? 'block' : 'none';
      Opt43Tab.encode();
    });

    UI.$('#opt43-ips').value = '192.168.1.10\n192.168.1.11';
    Opt43Tab.encode();
  },

  parseIpList(raw) {
    return raw.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
  },

  encode() {
    UI.showError('opt43-error', '');
    const out = UI.$('#opt43-output');
    out.innerHTML = '';
    try {
      const vendor = UI.$('#opt43-vendor').value;
      const ips = Opt43Tab.parseIpList(UI.$('#opt43-ips').value);
      const fom = vendor === 'cisco' && UI.$('#opt43-fom-toggle').checked;
      const fomModeRadio = document.querySelector('input[name="fom-mode"]:checked');
      const fomMode = fomModeRadio ? fomModeRadio.value : 'catalyst';

      const result = Option43.generate(vendor, ips, { fom, fomMode });
      Opt43Tab.renderEncode(result, out);
      if (window.innerWidth <= 640) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      UI.showError('opt43-error', '⚠ ' + e.message);
    }
  },

  renderEncode(r, container) {
    if (r.fom) {
      const fomBadge = document.createElement('div');
      fomBadge.className = 'fom-active-badge';
      fomBadge.innerHTML = `
        <span class="fom-icon">⚡</span>
        <strong>FOM Active:</strong> ${r.fomMode} Mode
        <span class="fom-byte">(suffix: 0x${r.fomModeByte})</span>
      `;
      container.appendChild(fomBadge);
    }

    const ciscoCard = UI.el('div', { class: 'card card-accent opt43-main-card' },
      UI.el('div', { class: 'card-header' },
        UI.el('div', { class: 'card-title', textContent: 'Cisco IOS Format' })
      ),
      UI.el('div', { class: 'opt43-hex-display' },
        UI.el('span', {
          class: 'hex-group hex-type',
          textContent: r.type,
          attrs: { title: `Type: Cisco vendor (0x${r.type})` }
        }),
        UI.el('span', {
          class: 'hex-group hex-length',
          textContent: r.length,
          attrs: { title: `Length: ${parseInt(r.length, 16)} bytes (${r.ipList.length} IP × 4)` }
        }),
        ...r.ipList.map((ip, i) => UI.el('span', {
          class: `hex-group hex-ip hex-ip-${(i % 4) + 1}`,
          textContent: Option43.ipToHexBytes(ip).join(''),
          attrs: { title: `IP #${i + 1}: ${ip}` }
        }))
      ),
      UI.el('div', { class: 'card-sub' },
        UI.el('code', {
          class: 'opt43-cli-snippet',
          textContent: `option 43 hex ${r.formats.ciscoFlat}`
        })
      ),
      UI.el('div', { class: 'opt43-legend' },
        UI.el('span', { class: 'legend-item' },
          UI.el('span', { class: 'legend-dot legend-type' }),
          'Type'
        ),
        UI.el('span', { class: 'legend-item' },
          UI.el('span', { class: 'legend-dot legend-length' }),
          'Length'
        ),
        ...r.ipList.map((ip, i) => UI.el('span', { class: 'legend-item' },
          UI.el('span', { class: `legend-dot legend-ip-${(i % 4) + 1}` }),
          ip
        ))
      )
    );

    const grid = UI.el('div', { class: 'result-grid' },
      ciscoCard,
      UI.card({
        title: 'Colon Notation',
        value: r.formats.colon,
        sub: 'Microsoft / Generic DHCP'
      }),
      UI.card({
        title: 'Raw Hex (UPPER)',
        value: r.formats.raw.toUpperCase(),
        sub: r.formats.bracketed
      })
    );
    container.appendChild(grid);

    container.appendChild(UI.detailSection('All Format Variations', [
      UI.detailRow('Cisco IOS — flat (ip dhcp pool)', r.formats.ciscoFlat, { copy: true }),
      UI.detailRow('Cisco IOS — dotted', r.formats.ciscoDot, { copy: true }),
      UI.detailRow('Spaced', r.formats.spaced, { copy: true }),
      UI.detailRow('Colon-separated', r.formats.colon, { copy: true }),
      UI.detailRow('Raw', r.formats.raw, { copy: true }),
      UI.detailRow('Bracketed (UPPER)', r.formats.bracketed, { copy: true })
    ]));

    const tlvBytesRow = UI.el('div', { class: 'tlv-bytes-row' },
      UI.el('span', { class: 'tlv-byte tlv-type', textContent: r.type }),
      UI.el('span', { class: 'tlv-byte tlv-length', textContent: r.length }),
      ...r.valueBytes.map(b => UI.el('span', { class: 'tlv-byte tlv-value', textContent: b }))
    );
    const tlvLegend = UI.el('div', { class: 'tlv-legend' },
      UI.el('div', {},
        UI.el('span', { class: 'tlv-legend-dot t', textContent: '■' }),
        ` Type — vendor identifier (0x${r.type})`
      ),
      UI.el('div', {},
        UI.el('span', { class: 'tlv-legend-dot l', textContent: '■' }),
        ` Length — ${parseInt(r.length, 16)} bytes (${r.ipList.length} × 4)`
      ),
      UI.el('div', {},
        UI.el('span', { class: 'tlv-legend-dot v', textContent: '■' }),
        ` Value — ${r.ipList.length} controller IP`
      )
    );
    const breakdown = UI.el('div', { class: 'detail-section' },
      UI.el('div', { class: 'detail-header', textContent: 'TLV Breakdown' }),
      UI.el('div', { class: 'tlv-container' }, tlvBytesRow, tlvLegend)
    );
    container.appendChild(breakdown);

    const ipGrid = UI.el('div', { class: 'ip-breakdown-grid' },
      ...r.breakdown.map((b, i) => {
        const octets = b.ip.split('.');
        const hexBytes = b.hex.split(' ');
        return UI.el('div', { class: `ip-breakdown-card ip-breakdown-${(i % 4) + 1}` },
          UI.el('div', { class: 'ip-breakdown-header' },
            UI.el('span', { class: 'ip-breakdown-num', textContent: `#${i + 1}` }),
            UI.el('span', { class: 'ip-breakdown-ip', textContent: b.ip })
          ),
          UI.el('div', { class: 'ip-breakdown-conversion' },
            ...octets.map((oct, oi) => UI.el('div', { class: 'octet-pair' },
              UI.el('div', { class: 'octet-dec', textContent: oct }),
              UI.el('div', { class: 'octet-arrow', textContent: '↓' }),
              UI.el('div', { class: 'octet-hex', textContent: hexBytes[oi] })
            ))
          ),
          UI.el('div', { class: 'ip-breakdown-result' },
            UI.el('span', { class: 'ip-breakdown-label', textContent: 'Hex:' }),
            UI.el('code', { textContent: hexBytes.join('') })
          )
        );
      })
    );
    const ipSec = UI.el('div', { class: 'detail-section' },
      UI.el('div', { class: 'detail-header', textContent: 'Per-Controller Breakdown' }),
      ipGrid
    );
    container.appendChild(ipSec);

    r.cliCommands.forEach(cmd => {
      container.appendChild(UI.el('div', { class: 'detail-section' },
        UI.el('div', { class: 'detail-header', textContent: cmd.label }),
        UI.el('pre', { class: 'code-block', textContent: cmd.code })
      ));
    });
  },

  decode() {
    UI.showError('opt43-decode-error', '');
    const out = UI.$('#opt43-decode-output');
    out.innerHTML = '';
    try {
      const hex = UI.$('#opt43-hex').value.trim();
      if (!hex) throw new Error('Enter hex string');
      const result = Option43.decode(hex);

      const grid = document.createElement('div');
      grid.className = 'result-grid';
      grid.appendChild(UI.card({
        title: 'Detected Vendor',
        value: result.vendor,
        sub: `Type byte: 0x${result.type}`,
        large: true
      }));
      grid.appendChild(UI.card({
        title: 'IP Count',
        value: String(result.ipCount),
        sub: `Length: ${result.length} bytes`
      }));
      if (result.fom) {
        grid.appendChild(UI.card({
          title: 'FOM Mode',
          value: result.fomMode,
          sub: 'Wi-Fi 7 Fast Offline Migration'
        }));
      }
      out.appendChild(grid);

      const tblSec = document.createElement('div');
      tblSec.className = 'detail-section';
      tblSec.innerHTML = `<div class="detail-header">Extracted Controller IPs</div>`;
      const wrap = document.createElement('div');
      wrap.className = 'table-wrapper';
      const table = document.createElement('table');
      table.className = 'results-table';
      table.classList.add('table-flush');
      table.innerHTML = `<thead><tr><th>#</th><th>Controller IP</th></tr></thead><tbody></tbody>`;
      const tbody = table.querySelector('tbody');
      result.ips.forEach((ip, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i + 1}</td><td><strong>${ip}</strong></td>`;
        tbody.appendChild(tr);
      });
      wrap.appendChild(table);
      tblSec.appendChild(wrap);
      out.appendChild(tblSec);

      if (window.innerWidth <= 640) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      UI.showError('opt43-decode-error', '⚠ ' + e.message);
    }
  }
};

// ===========================================================
// TAB: SUBNET OVERLAP DETECTOR
// ===========================================================
const OverlapTab = {
  init() {
    UI.$('#overlap-form').addEventListener('submit', e => {
      e.preventDefault();
      OverlapTab.calculate();
    });
    UI.$('#overlap-input').value = '192.168.1.0/24\n192.168.1.128/25\n10.0.0.0/8\n10.5.0.0/16';
    OverlapTab.calculate();
  },

  calculate() {
    UI.showError('overlap-error', '');
    const out = UI.$('#overlap-output');
    out.innerHTML = '';
    try {
      const lines = UI.$('#overlap-input').value
        .split('\n').map(l => l.trim()).filter(Boolean);
      const result = Overlap.analyze(lines);
      OverlapTab.render(result, out);
      if (window.innerWidth <= 640) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      UI.showError('overlap-error', '⚠ ' + e.message);
    }
  },

  render(result, container) {
    const stat = (label, value, valueClass = '') => UI.el('div', { class: 'summary-stat' },
      UI.el('span', { class: 'label', textContent: label }),
      UI.el('span', { class: `value ${valueClass}`.trim(), textContent: value })
    );
    const statusText = result.summary.clean ? '✓ Clean' : `⚠ ${result.summary.conflictCount} conflict`;
    container.appendChild(UI.el('div', { class: 'summary-bar' },
      stat('Networks', result.summary.total),
      stat('Conflict', result.summary.conflictCount, result.summary.clean ? '' : 'accent'),
      stat('Status', statusText, result.summary.clean ? 'success' : 'warn')
    ));

    const tbody1Frag = document.createDocumentFragment();
    result.networks.forEach((n, i) => {
      const involved = result.conflicts.some(c => c.indexA === i || c.indexB === i);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td><strong>${n.network.cidrNotation}</strong></td>
        <td>${n.network.decimal} – ${n.broadcast.decimal}</td>
        <td>${UI.formatNumber(n.counts.usable)}</td>
        <td>${involved ? '<span class="status-warn">⚠ Conflict</span>' : '<span class="status-ok">✓ OK</span>'}</td>
      `;
      tbody1Frag.appendChild(tr);
    });
    const t1 = UI.el('table', { class: 'results-table table-flush', html:
      '<thead><tr><th>#</th><th>Network</th><th>Range</th><th>Hosts</th><th>Status</th></tr></thead><tbody></tbody>'
    });
    t1.querySelector('tbody').appendChild(tbody1Frag);
    container.appendChild(UI.el('div', { class: 'detail-section' },
      UI.el('div', { class: 'detail-header', textContent: 'Input Networks' }),
      UI.el('div', { class: 'table-wrapper' }, t1)
    ));

    if (result.conflicts.length > 0) {
      const typeLabels = {
        identical:    '<span class="cidr-pill danger">IDENTICAL — same network</span>',
        a_contains_b: '<span class="cidr-pill warning">A ⊃ B — A contains B</span>',
        b_contains_a: '<span class="cidr-pill warning">B ⊃ A — B contains A</span>',
        partial:      '<span class="cidr-pill danger">PARTIAL — partial overlap</span>'
      };
      const tbody2Frag = document.createDocumentFragment();
      result.conflicts.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = 'row-error';
        tr.innerHTML = `
          <td><strong>${c.a.network.cidrNotation}</strong><br><span class="cell-sub">${c.a.network.decimal} – ${c.a.broadcast.decimal}</span></td>
          <td><strong>${c.b.network.cidrNotation}</strong><br><span class="cell-sub">${c.b.network.decimal} – ${c.b.broadcast.decimal}</span></td>
          <td>${typeLabels[c.type] || c.type}</td>
        `;
        tbody2Frag.appendChild(tr);
      });
      const t2 = UI.el('table', { class: 'results-table table-flush', html:
        '<thead><tr><th>Network A</th><th>Network B</th><th>Relationship</th></tr></thead><tbody></tbody>'
      });
      t2.querySelector('tbody').appendChild(tbody2Frag);
      container.appendChild(UI.el('div', { class: 'detail-section' },
        UI.el('div', { class: 'detail-header', textContent: 'Detected Conflicts' }),
        UI.el('div', { class: 'table-wrapper' }, t2)
      ));
    } else {
      container.appendChild(UI.el('div', {
        class: 'success-banner',
        textContent: '✓ No overlaps detected. All networks are independent.'
      }));
    }
  }
};

// ===========================================================
// TAB: NUMBER BASE CONVERTER
// ===========================================================
const NumBaseTab = {
  busy: false,

  init() {
    UI.$$('.numbase-input').forEach(inp => {
      inp.addEventListener('input', e => NumBaseTab.onChange(e.target));
    });
    UI.$('#num-dec').value = '42';
    NumBaseTab.onChange(UI.$('#num-dec'));
  },

  onChange(source) {
    if (NumBaseTab.busy) return;
    UI.showError('numbase-error', '');

    const fromBase = parseInt(source.dataset.base, 10);
    const value = source.value;

    if (!value.trim()) {
      NumBaseTab.busy = true;
      UI.$$('.numbase-input').forEach(i => { if (i !== source) i.value = ''; });
      NumBaseTab.busy = false;
      UI.$('#numbase-output').innerHTML = '';
      return;
    }

    try {
      const result = NumBase.convertAll(value, fromBase);
      if (!result) return;

      NumBaseTab.busy = true;
      if (source.id !== 'num-dec') UI.$('#num-dec').value = result.dec;
      if (source.id !== 'num-hex') UI.$('#num-hex').value = result.hex;
      if (source.id !== 'num-bin') UI.$('#num-bin').value = result.bin;
      if (source.id !== 'num-oct') UI.$('#num-oct').value = result.oct;
      NumBaseTab.busy = false;

      NumBaseTab.renderOutput(result);
    } catch (e) {
      UI.showError('numbase-error', '⚠ ' + e.message);
    }
  },

  renderOutput(r) {
    const out = UI.$('#numbase-output');
    out.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'result-grid';
    grid.appendChild(UI.card({
      title: 'Decimal',
      value: r.dec,
      sub: `${r.dec.length} digit`,
      large: true
    }));
    grid.appendChild(UI.card({
      title: 'Hexadecimal',
      value: '0x' + r.hex,
      sub: `${r.hex.length} hex digit`
    }));
    grid.appendChild(UI.card({
      title: 'Binary',
      value: r.bin.length > 32 ? r.bin.slice(0, 32) + '…' : r.bin,
      sub: `${r.bin.length} bit`
    }));
    grid.appendChild(UI.card({
      title: 'Octal',
      value: '0o' + r.oct,
      sub: `${r.oct.length} octal digit`
    }));
    out.appendChild(grid);

    out.appendChild(UI.detailSection('All Representations', [
      UI.detailRow('Decimal', r.dec, { copy: true }),
      UI.detailRow('Hex (0x)', '0x' + r.hex, { copy: true }),
      UI.detailRow('Hex (raw)', r.hex, { copy: true }),
      UI.detailRow('Binary', r.bin, { copy: true }),
      UI.detailRow('Binary (grouped)', NumBase.binGrouped(r.bigInt), { copy: true }),
      UI.detailRow('Octal', r.oct, { copy: true })
    ]));

    const bitInfo = document.createElement('div');
    bitInfo.className = 'detail-section';
    bitInfo.innerHTML = `<div class="detail-header">Bit Information</div>`;
    const grid2 = document.createElement('div');
    grid2.className = 'detail-rows';
    const bits = r.bin.length;
    const fits = bits <= 8 ? '8-bit (byte)' : bits <= 16 ? '16-bit (word)' : bits <= 32 ? '32-bit (IPv4)' : bits <= 64 ? '64-bit' : bits <= 128 ? '128-bit (IPv6)' : `${bits}-bit`;
    const isPow2 = (r.bigInt > 0n && (r.bigInt & (r.bigInt - 1n)) === 0n);

    [
      ['Bit length', String(bits)],
      ['Fits in', fits],
      ['Decimal value', r.dec],
      ['Power of 2?', isPow2 ? `Yes (2^${bits - 1})` : 'No']
    ].forEach(([k, v]) => {
      const a = document.createElement('div'); a.textContent = k;
      const b = document.createElement('div'); b.textContent = v;
      grid2.appendChild(a); grid2.appendChild(b);
    });
    bitInfo.appendChild(grid2);
    out.appendChild(bitInfo);
  }
};

// ===========================================================
// TAB: OSPF COST CALCULATOR
// ===========================================================
const OSPFTab = {
  init() {
    UI.$('#ospf-ref-bw').addEventListener('change', e => {
      UI.$('#ospf-custom-wrap').style.display = e.target.value === 'custom' ? 'flex' : 'none';
    });
    UI.$('#ospf-form').addEventListener('submit', e => {
      e.preventDefault();
      OSPFTab.calculate();
    });
    OSPFTab.calculate();
  },

  calculate() {
    UI.showError('ospf-error', '');
    const out = UI.$('#ospf-output');
    out.innerHTML = '';
    try {
      const ifaceBw = parseFloat(UI.$('#ospf-iface-bw').value);
      const refSel = UI.$('#ospf-ref-bw').value;
      const refBw = refSel === 'custom'
        ? parseFloat(UI.$('#ospf-custom-ref').value)
        : parseFloat(refSel);
      const cost = OSPFCalc.cost(refBw, ifaceBw);

      const grid = document.createElement('div');
      grid.className = 'result-grid';
      grid.appendChild(UI.card({
        title: 'OSPF Cost',
        value: String(cost),
        sub: cost === 1
          ? 'Minimum cost (interface BW ≥ ref BW)'
          : `${refBw} / ${ifaceBw} = ${(refBw / ifaceBw).toFixed(2)}`,
        large: true
      }));
      out.appendChild(grid);

      out.appendChild(UI.detailSection('Calculation', [
        UI.detailRow('Interface BW', `${ifaceBw} Mbps`),
        UI.detailRow('Reference BW', `${refBw} Mbps`),
        UI.detailRow('Formula', `floor(${refBw} / ${ifaceBw}) = ${Math.floor(refBw / ifaceBw)}`),
        UI.detailRow('Final Cost', `max(1, ${Math.floor(refBw / ifaceBw)}) = ${cost}`)
      ]));

      const cisco = document.createElement('div');
      cisco.className = 'detail-section';
      cisco.innerHTML = `<div class="detail-header">Cisco IOS Snippets</div>`;
      const code = document.createElement('pre');
      code.className = 'code-block';
      code.textContent = `! Auto-cost reference (global)\nrouter ospf 1\n auto-cost reference-bandwidth ${refBw}\n!\n! Manual override (interface)\ninterface GigabitEthernet0/1\n ip ospf cost ${cost}`;
      cisco.appendChild(code);
      out.appendChild(cisco);

      if (window.innerWidth <= 640) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      UI.showError('ospf-error', '⚠ ' + e.message);
    }
  }
};

// ===========================================================
// TAB: EIGRP METRIC CALCULATOR
// ===========================================================
const EIGRPTab = {
  init() {
    UI.$('#eigrp-form').addEventListener('submit', e => {
      e.preventDefault();
      EIGRPTab.calculate();
    });
    EIGRPTab.calculate();
  },

  calculate() {
    UI.showError('eigrp-error', '');
    const out = UI.$('#eigrp-output');
    out.innerHTML = '';
    try {
      const params = {
        bw: parseInt(UI.$('#eigrp-bw').value, 10),
        delay: parseInt(UI.$('#eigrp-delay').value, 10),
        load: parseInt(UI.$('#eigrp-load').value, 10),
        reliability: parseInt(UI.$('#eigrp-rel').value, 10),
        k1: parseInt(UI.$('#eigrp-k1').value, 10),
        k2: parseInt(UI.$('#eigrp-k2').value, 10),
        k3: parseInt(UI.$('#eigrp-k3').value, 10),
        k4: parseInt(UI.$('#eigrp-k4').value, 10),
        k5: parseInt(UI.$('#eigrp-k5').value, 10)
      };
      const r = EIGRPCalc.metric(params);

      const grid = document.createElement('div');
      grid.className = 'result-grid';
      grid.appendChild(UI.card({
        title: 'EIGRP Metric',
        value: UI.formatNumber(r.metric),
        sub: r.formula,
        large: true
      }));
      grid.appendChild(UI.card({
        title: 'BW Term',
        value: UI.formatNumber(r.bwTerm),
        sub: `10^7 / ${UI.formatNumber(params.bw)} kbps`
      }));
      grid.appendChild(UI.card({
        title: 'Delay Term',
        value: UI.formatNumber(r.delayTerm),
        sub: `${UI.formatNumber(params.delay)} μs / 10`
      }));
      out.appendChild(grid);

      out.appendChild(UI.detailSection('Inputs', [
        UI.detailRow('Bandwidth', `${UI.formatNumber(params.bw)} kbps`),
        UI.detailRow('Delay', `${UI.formatNumber(params.delay)} μs`),
        UI.detailRow('Load', String(params.load)),
        UI.detailRow('Reliability', String(params.reliability)),
        UI.detailRow('K-values', `K1=${params.k1} K2=${params.k2} K3=${params.k3} K4=${params.k4} K5=${params.k5}`),
        UI.detailRow('K5 applied?', r.k5Applied ? 'Yes' : 'No (K5=0)')
      ]));

      if (window.innerWidth <= 640) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      UI.showError('eigrp-error', '⚠ ' + e.message);
    }
  }
};

// ===========================================================
// TAB: IP RANGE ↔ CIDR
// ===========================================================
const CidRangeTab = {
  init() {
    UI.$$('#cidrange-mode-toggle .mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        UI.$$('#cidrange-mode-toggle .mode-btn').forEach(b =>
          b.classList.toggle('active', b === btn));
        const m = btn.dataset.mode;
        UI.$('#cidrange-r2c').style.display = m === 'r2c' ? 'block' : 'none';
        UI.$('#cidrange-c2r').style.display = m === 'c2r' ? 'block' : 'none';
        UI.$('#cidrange-output').innerHTML = '';
        UI.showError('cidrange-error', '');
        if (m === 'r2c') CidRangeTab.r2c(); else CidRangeTab.c2r();
      });
    });
    UI.$('#cidrange-r2c-form').addEventListener('submit', e => {
      e.preventDefault();
      CidRangeTab.r2c();
    });
    UI.$('#cidrange-c2r-form').addEventListener('submit', e => {
      e.preventDefault();
      CidRangeTab.c2r();
    });
    CidRangeTab.r2c();
  },

  r2c() {
    UI.showError('cidrange-error', '');
    const out = UI.$('#cidrange-output');
    out.innerHTML = '';
    try {
      const start = UI.$('#cidrange-start').value.trim();
      const end = UI.$('#cidrange-end').value.trim();
      const r = RangeCidr.rangeToCidrs(start, end);

      const grid = document.createElement('div');
      grid.className = 'result-grid';
      grid.appendChild(UI.card({
        title: 'CIDR Blocks',
        value: String(r.blockCount),
        sub: `covers ${start} – ${end}`,
        large: true
      }));
      grid.appendChild(UI.card({
        title: 'Total IPs',
        value: UI.formatNumber(r.totalIps),
        sub: 'Across all blocks'
      }));
      out.appendChild(grid);

      const tblSec = document.createElement('div');
      tblSec.className = 'detail-section';
      tblSec.innerHTML = `<div class="detail-header">CIDR Blocks</div>`;
      const wrap = document.createElement('div');
      wrap.className = 'table-wrapper';
      const t = document.createElement('table');
      t.className = 'results-table';
      t.classList.add('table-flush');
      t.innerHTML = `<thead><tr><th>#</th><th>CIDR</th><th>Range</th><th>Count</th></tr></thead><tbody></tbody>`;
      const tbody = t.querySelector('tbody');
      r.blocks.forEach((b, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i + 1}</td><td><strong>${b.network.cidrNotation}</strong></td><td>${b.network.decimal} – ${b.broadcast.decimal}</td><td>${UI.formatNumber(b.counts.total)}</td>`;
        tbody.appendChild(tr);
      });
      wrap.appendChild(t);
      tblSec.appendChild(wrap);
      out.appendChild(tblSec);

      if (window.innerWidth <= 640) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      UI.showError('cidrange-error', '⚠ ' + e.message);
    }
  },

  c2r() {
    UI.showError('cidrange-error', '');
    const out = UI.$('#cidrange-output');
    out.innerHTML = '';
    try {
      const r = RangeCidr.cidrToRange(UI.$('#cidrange-cidr').value.trim());
      const grid = document.createElement('div');
      grid.className = 'result-grid';
      grid.appendChild(UI.card({ title: 'CIDR', value: r.cidr, large: true }));
      grid.appendChild(UI.card({ title: 'First IP', value: r.first, sub: 'Network address' }));
      grid.appendChild(UI.card({ title: 'Last IP', value: r.last, sub: 'Broadcast' }));
      grid.appendChild(UI.card({ title: 'Total', value: UI.formatNumber(r.count) }));
      out.appendChild(grid);
      if (window.innerWidth <= 640) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      UI.showError('cidrange-error', '⚠ ' + e.message);
    }
  }
};

// ===========================================================
// TAB: PING SWEEP
// ===========================================================
const PingSweepTab = {
  init() {
    UI.$('#ps-form').addEventListener('submit', e => {
      e.preventDefault();
      PingSweepTab.generate();
    });
    UI.$('#ps-format').addEventListener('change', () => PingSweepTab.generate());
    PingSweepTab.generate();
  },

  generate() {
    UI.showError('ps-error', '');
    const out = UI.$('#ps-output');
    out.innerHTML = '';
    try {
      const cidr = UI.$('#ps-network').value.trim();
      const format = UI.$('#ps-format').value;
      const r = PingSweep.generate(cidr, format);

      const grid = document.createElement('div');
      grid.className = 'result-grid';
      grid.appendChild(UI.card({
        title: 'Network',
        value: r.network,
        sub: `${UI.formatNumber(r.count)} host IP`,
        large: true
      }));
      out.appendChild(grid);

      const sec = document.createElement('div');
      sec.className = 'detail-section';
      sec.innerHTML = `<div class="detail-header">Output (${format})</div>`;
      const pre = document.createElement('pre');
      pre.className = 'code-block scrollable-output';
      pre.textContent = r.output;
      sec.appendChild(pre);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = 'Copy All';
      copyBtn.classList.add('copy-btn-margin');
      copyBtn.addEventListener('click', () => UI.copyToClipboard(r.output, copyBtn));
      sec.appendChild(copyBtn);

      out.appendChild(sec);
      if (window.innerWidth <= 640) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      UI.showError('ps-error', '⚠ ' + e.message);
    }
  }
};

// ===========================================================
// TAB: REVERSE DNS / PTR
// ===========================================================
const PTRTab = {
  init() {
    UI.$('#ptr-form').addEventListener('submit', e => {
      e.preventDefault();
      PTRTab.calculate();
    });
    PTRTab.calculate();
  },

  calculate() {
    UI.showError('ptr-error', '');
    const out = UI.$('#ptr-output');
    out.innerHTML = '';
    try {
      const r = PTRGen.generate(UI.$('#ptr-ip').value);

      if (r.type === 'ipv4-range') {
        const grid = document.createElement('div');
        grid.className = 'result-grid';
        grid.appendChild(UI.card({
          title: 'PTR Records',
          value: String(r.count),
          sub: 'IPv4 range',
          large: true
        }));
        out.appendChild(grid);

        const sec = document.createElement('div');
        sec.className = 'detail-section';
        sec.innerHTML = `<div class="detail-header">PTR List</div>`;
        const wrap = document.createElement('div');
        wrap.className = 'table-wrapper';
        const t = document.createElement('table');
        t.className = 'results-table';
        t.classList.add('table-flush');
        t.innerHTML = `<thead><tr><th>IP</th><th>PTR Name</th></tr></thead><tbody></tbody>`;
        const tbody = t.querySelector('tbody');
        const frag = document.createDocumentFragment();
        r.list.forEach(item => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${item.ip}</td><td><code>${item.ptr}</code></td>`;
          frag.appendChild(tr);
        });
        tbody.appendChild(frag);
        wrap.appendChild(t);
        sec.appendChild(wrap);
        out.appendChild(sec);
      } else {
        const grid = document.createElement('div');
        grid.className = 'result-grid';
        grid.appendChild(UI.card({
          title: 'PTR Name',
          value: r.ptr,
          sub: r.type.toUpperCase(),
          large: true
        }));
        out.appendChild(grid);

        out.appendChild(UI.detailSection('Details', [
          UI.detailRow('Input IP', r.ip, { copy: true }),
          UI.detailRow('PTR Record', r.ptr, { copy: true }),
          UI.detailRow('Type', r.type === 'ipv6' ? 'IPv6 (.ip6.arpa)' : 'IPv4 (.in-addr.arpa)')
        ]));

        const bind = document.createElement('div');
        bind.className = 'detail-section';
        bind.innerHTML = `<div class="detail-header">BIND Zone Example</div>`;
        const pre = document.createElement('pre');
        pre.className = 'code-block';
        pre.textContent = `; Reverse zone\n${r.ptr}.  IN  PTR  hostname.example.com.`;
        bind.appendChild(pre);
        out.appendChild(bind);
      }

      if (window.innerWidth <= 640) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      UI.showError('ptr-error', '⚠ ' + e.message);
    }
  }
};

// ===========================================================
// TAB SWITCHER
// ===========================================================
const TabSwitcher = {
  init() {
    UI.$$('.tab-button').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        UI.$$('.tab-button').forEach(b => b.classList.toggle('active', b === btn));
        UI.$$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${target}`));
      });
    });
  }
};

// ===========================================================
// DEEPLINK / URL SHARING
// ===========================================================
const Deeplink = {
  init() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab) {
      const btn = UI.$(`.tab-button[data-tab="${tab}"]`);
      if (btn) btn.click();
    }

    if (tab === 'subnet') {
      if (params.get('ip')) UI.$('#subnet-ip').value = params.get('ip');
      if (params.get('cidr')) UI.$('#subnet-cidr').value = params.get('cidr');
      if (params.get('ip') || params.get('cidr')) UI.$('#subnet-calc-btn').click();
    }
    if (tab === 'opt43') {
      if (params.get('ips')) UI.$('#opt43-ips').value = params.get('ips').replace(/,/g, '\n');
      if (params.get('vendor')) UI.$('#opt43-vendor').value = params.get('vendor');
      if (params.get('fom') === '1') {
        UI.$('#opt43-fom-toggle').checked = true;
        UI.$('#opt43-fom-toggle').dispatchEvent(new Event('change'));
      }
      if (params.get('mode')) {
        const radio = document.querySelector(`input[name="fom-mode"][value="${params.get('mode')}"]`);
        if (radio) radio.checked = true;
      }
      UI.$('#opt43-gen-btn').click();
    }
    if (tab === 'ipv6') {
      if (params.get('addr')) UI.$('#ipv6-addr').value = params.get('addr');
      if (params.get('prefix')) UI.$('#ipv6-prefix').value = params.get('prefix');
      if (params.get('addr') || params.get('prefix')) UI.$('#ipv6-calc-btn').click();
    }

    UI.$('#share-btn')?.addEventListener('click', () => {
      const activeTab = document.querySelector('.tab-button.active')?.dataset.tab;
      if (!activeTab) return;

      const shareParams = {};
      if (activeTab === 'subnet') {
        shareParams.ip = UI.$('#subnet-ip').value;
        shareParams.cidr = UI.$('#subnet-cidr').value;
      } else if (activeTab === 'opt43') {
        shareParams.ips = UI.$('#opt43-ips').value.split('\n').filter(Boolean).join(',');
        shareParams.vendor = UI.$('#opt43-vendor').value;
        if (UI.$('#opt43-fom-toggle').checked) {
          shareParams.fom = '1';
          const r = document.querySelector('input[name="fom-mode"]:checked');
          if (r) shareParams.mode = r.value;
        }
      } else if (activeTab === 'ipv6') {
        shareParams.addr = UI.$('#ipv6-addr').value;
        shareParams.prefix = UI.$('#ipv6-prefix').value;
      }

      const url = Deeplink.shareUrl(activeTab, shareParams);
      navigator.clipboard.writeText(url).then(() => {
        const btn = UI.$('#share-btn');
        const orig = btn.innerHTML;
        btn.innerHTML = '<span>✓ Copied!</span>';
        setTimeout(() => { btn.innerHTML = orig; }, 1500);
      });
    });
  },

  shareUrl(tab, params = {}) {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('tab', tab);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== '' && v != null) url.searchParams.set(k, v);
    });
    return url.toString();
  }
};

// ===========================================================
// KEYBOARD SHORTCUTS
// ===========================================================
const Shortcuts = {
  init() {
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        Shortcuts.openTabSwitcher();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key)) {
        const tabs = UI.$$('.tab-button');
        const idx = parseInt(e.key, 10) - 1;
        if (tabs[idx]) {
          e.preventDefault();
          tabs[idx].click();
        }
        return;
      }
      if (e.key === '?' && !e.target.matches('input, textarea, select')) {
        e.preventDefault();
        Shortcuts.showHelp();
      }
    });

    UI.$('#help-btn')?.addEventListener('click', () => Shortcuts.showHelp());
  },

  openTabSwitcher() {
    if (document.querySelector('.shortcut-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'shortcut-overlay';
    overlay.innerHTML = `
      <div class="shortcut-palette">
        <input type="text" class="shortcut-search" placeholder="Type to filter tabs..." autofocus>
        <div class="shortcut-list" id="shortcut-list"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const list = overlay.querySelector('#shortcut-list');
    const tabs = UI.$$('.tab-button').map(b => ({
      el: b,
      label: b.textContent.trim(),
      data: b.dataset.tab
    }));

    const render = (filter = '') => {
      list.innerHTML = '';
      const frag = document.createDocumentFragment();
      tabs
        .filter(t => t.label.toLowerCase().includes(filter.toLowerCase()))
        .forEach((t, i) => {
          const item = document.createElement('div');
          item.className = 'shortcut-item' + (i === 0 ? ' active' : '');
          item.textContent = t.label;
          item.addEventListener('click', () => {
            t.el.click();
            overlay.remove();
          });
          frag.appendChild(item);
        });
      list.appendChild(frag);
    };
    render();

    const input = overlay.querySelector('.shortcut-search');
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') overlay.remove();
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = list.querySelector('.shortcut-item');
        if (first) first.click();
      }
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
  },

  showHelp() {
    if (document.querySelector('.shortcut-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'shortcut-overlay';
    overlay.innerHTML = `
      <div class="shortcut-palette shortcut-help">
        <div class="shortcut-help-title">Keyboard Shortcuts</div>
        <div class="shortcut-help-list">
          <div><span><kbd>Ctrl</kbd>+<kbd>K</kbd></span> <span>Quick tab switcher</span></div>
          <div><span><kbd>Ctrl</kbd>+<kbd>1-9</kbd></span> <span>Jump to tab N</span></div>
          <div><span><kbd>Enter</kbd></span> <span>Calculate (in any input)</span></div>
          <div><span><kbd>?</kbd></span> <span>This help</span></div>
          <div><span><kbd>Esc</kbd></span> <span>Close overlay</span></div>
        </div>
        <div class="shortcut-help-close">Click anywhere to close</div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => overlay.remove());
    const close = e => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', close);
      }
    };
    document.addEventListener('keydown', close);
  }
};

// ===========================================================
// THEME TOGGLE (dark / light)
// ===========================================================
const ThemeToggle = {
  init() {
    const saved = localStorage.getItem('netcalc-theme') || 'dark';
    document.documentElement.dataset.theme = saved;
    ThemeToggle.updateIcon(saved);

    UI.$('#theme-btn')?.addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme || 'dark';
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('netcalc-theme', next);
      ThemeToggle.updateIcon(next);
    });
  },

  updateIcon(theme) {
    const btn = UI.$('#theme-btn');
    if (!btn) return;
    btn.innerHTML = theme === 'dark' ? '☀' : '☾';
    btn.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  }
};

// ===========================================================
// INIT
// ===========================================================
document.addEventListener('DOMContentLoaded', () => {
  TabSwitcher.init();
  SubnetTab.init();
  VlsmTab.init();
  SupernetTab.init();
  WildcardTab.init();
  SplitTab.init();
  IPv6Tab.init();
  Opt43Tab.init();
  OverlapTab.init();
  NumBaseTab.init();
  OSPFTab.init();
  EIGRPTab.init();
  CidRangeTab.init();
  PingSweepTab.init();
  PTRTab.init();
  ThemeToggle.init();
  Shortcuts.init();
  Deeplink.init();
});
