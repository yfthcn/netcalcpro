# NetCalc Pro

> A vendor-free, dependency-free network engineering toolkit. 15 modules covering subnet math, VLSM, DHCP Option 43, IPv6, OSPF/EIGRP metrics, and more.

**Live demo:** [yfthcn.github.io/netcalcpro](https://yfthcn.github.io/netcalcpro/)

![Theme](https://img.shields.io/badge/theme-dark%20%2F%20light-1BA0D7)
![Vanilla JS](https://img.shields.io/badge/vanilla-JS-F7DF1E)
![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success)
![Mobile](https://img.shields.io/badge/mobile-responsive-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Why NetCalc Pro?

Most online subnet calculators are either ad-laden, vendor-locked, or solve only one problem. NetCalc Pro is built **by a network engineer for network engineers**:

- **Zero external calls** — all calculations run client-side, your IPs never leave the browser
- **Zero dependencies** — pure vanilla HTML/CSS/JS, no React, no build step, no `node_modules`
- **15 focused modules** — from `/24` subnet math to Cisco Wi-Fi 7 FOM hex generation
- **Dark + Light themes** — Cisco DNA Center-inspired professional aesthetic
- **CCNA/CCNP companion** — built-in references with RFC links for every concept

---

## Modules

### Subnetting & IP

| Module | Description |
|---|---|
| **Subnet Calculator** | Network/broadcast/host range from IPv4 + CIDR. Network and host bits highlighted in binary. RFC 3021 (`/31`) and host route (`/32`) handled correctly. |
| **VLSM** | Variable Length Subnet Masking. Sort-by-size algorithm with block-boundary alignment. Per-subnet utilization report. |
| **Supernet** | Route summarization — find the smallest covering CIDR for multiple networks. |
| **Split Subnet** | FLSM — divide a parent network into N equal subnets. |
| **Wildcard** | Inverse mask for Cisco ACL and OSPF/EIGRP `network` statements. |
| **IPv6** | 128-bit BigInt math. RFC 5952 compression, type detection (GUA/ULA/link-local/multicast/doc/6to4/Teredo). |

### Wireless / DHCP

| Module | Description |
|---|---|
| **Option 43** | DHCP Option 43 hex generator for Cisco WLC and Ruckus (ZD/SmartZone). FOM (Fast Offline Migration) for Wi-Fi 7 APs with Catalyst/Meraki mode toggle. Per-IP color-coded byte breakdown. Encode + Decode. |

### Network Planning

| Module | Description |
|---|---|
| **Overlap Detector** | Find conflicting/overlapping CIDR blocks. Identifies identical, contains-A, contains-B, and partial overlaps. |
| **Range ↔ CIDR** | Convert IP ranges to minimum CIDR blocks (firewall ACL planning) and vice versa. |
| **Ping Sweep** | Generate host IPs as newline/comma/bash for-loop/nmap/fping format. Up to 4096 IPs. |
| **Reverse DNS / PTR** | Generate `in-addr.arpa` (IPv4) and `ip6.arpa` (IPv6) PTR records. Bulk mode for `/24` zones. |

### Routing Calculators (CCNA/CCNP)

| Module | Description |
|---|---|
| **OSPF Cost** | `auto-cost reference-bandwidth` calculator. Default 100 / 1G / 10G / 100G presets. |
| **EIGRP Metric** | Classic composite metric: `(K1×BW + K2×BW/(256-load) + K3×Delay) × (K5/(R+K4)) × 256`. |

### Utilities

| Module | Description |
|---|---|
| **Base Converter** | Decimal ↔ Hex ↔ Binary ↔ Octal. BigInt-backed (no 32-bit limit). Power-of-2 detector. |
| **References** | RFC cheatsheet covering 22 RFCs (791, 950, 1035, 1518, 1519, 1812, 1878, 1918, 2132, 2328, 3021, 3596, 3849, 3925, 3927, 4193, 4271, 4291, 4632, 5415, 5952, 6598, 7868). |

---

## Features

- **3 responsive breakpoints** — desktop / tablet (≤1024px) / mobile (≤640px) / extra-small (≤380px)
- **Keyboard shortcuts** — `Ctrl+K` quick tab switcher, `Ctrl+1-9` jump to tab N, `?` help modal
- **URL deeplinks** — share calculations via `?tab=opt43&ips=...&fom=1&mode=catalyst`
- **Print-friendly** — clean PDF output for documentation
- **Theme persistence** — localStorage-backed light/dark toggle
- **Copy buttons** — every output value is one-click copyable
- **Cisco IOS snippets** — generated config examples for every module

---

## Quick Start

### Use the live demo

Visit [yfthcn.github.io/netcalcpro](https://yfthcn.github.io/netcalcpro/) — works on any modern browser.

### Self-host (recommended for production)

```bash
git clone https://github.com/yfthcn/netcalcpro.git
cd netcalcpro
# Open index.html directly, or serve with any static server:
python3 -m http.server 8000
# → http://localhost:8000
```

### Docker + Cloudflare Tunnel

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
```

```bash
docker build -t netcalcpro .
docker run -d -p 8080:80 --name netcalcpro netcalcpro
```

---

## Architecture

```
netcalcpro/
├── index.html              ← Single entry point (15 tabs)
├── css/style.css           ← Cisco-themed dark + light styles (~2900 lines)
└── js/
    ├── ipv4.js             ← IPv4 math engine (subnet, VLSM, supernet, split)
    ├── ipv6.js             ← IPv6 math engine (BigInt, expand/compress)
    ├── option43.js         ← DHCP Option 43 TLV encoder/decoder + FOM
    ├── overlap.js          ← CIDR overlap detection
    ├── numbase.js          ← Base conversion (BigInt-backed)
    ├── calculators.js      ← OSPF, EIGRP, Range↔CIDR, Ping Sweep, PTR
    ├── ui-helpers.js       ← DOM helpers (UI.el, UI.card, UI.detailRow)
    └── app.js              ← Tab controllers, theme, shortcuts, deeplinks
```

**No build pipeline.** Every file loads via `<script>` tags. No bundler, no transpiler, no `node_modules`. Edit any file and refresh the browser.

---

## Standards Compliance

All calculations are validated against the relevant RFCs:

- **RFC 791** — Internet Protocol (IPv4 structure)
- **RFC 950** — Internet Standard Subnetting Procedure
- **RFC 1035** — DNS specifications (PTR records)
- **RFC 1518/1519** — CIDR aggregation
- **RFC 1878** — Variable Length Subnet Table for IPv4
- **RFC 1918** — Address Allocation for Private Internets
- **RFC 2132** — DHCP Options and BOOTP Vendor Extensions
- **RFC 2328** — OSPF Version 2
- **RFC 3021** — Using 31-Bit Prefixes on IPv4 P2P Links
- **RFC 3596** — DNS Extensions to Support IP Version 6
- **RFC 3849** — IPv6 Documentation Address (`2001:db8::/32`)
- **RFC 3925** — Vendor-Identifying Vendor Options for DHCPv4
- **RFC 3927** — Dynamic Configuration of IPv4 Link-Local Addresses
- **RFC 4193** — Unique Local IPv6 Unicast Addresses
- **RFC 4271** — Border Gateway Protocol 4 (BGP-4)
- **RFC 4291** — IP Version 6 Addressing Architecture
- **RFC 4632** — Classless Inter-Domain Routing (CIDR)
- **RFC 5415** — CAPWAP Protocol Specification
- **RFC 5952** — A Recommendation for IPv6 Address Text Representation
- **RFC 6598** — IANA-Reserved IPv4 Prefix for Shared Address Space (CGNAT)
- **RFC 7868** — Cisco's Enhanced Interior Gateway Routing Protocol (EIGRP)

---

## Browser Compatibility

Tested on:

- ✅ Chrome / Edge 100+
- ✅ Firefox 100+
- ✅ Safari 15+
- ✅ Mobile Safari (iOS 15+)
- ✅ Chrome Mobile (Android 12+)

Uses native `BigInt`, CSS Grid, CSS Custom Properties, `URLSearchParams`. No polyfills required.

---

## Contributing

Issues and pull requests welcome. The codebase is intentionally minimal:

- No JS framework — keep it vanilla
- No build step — every file is the source
- No external services — all calculations stay client-side
- Match existing style (4-space indent, descriptive variable names)

---

## License

MIT — see [LICENSE](LICENSE)

---

## Author

Built by [@yfthcn](https://github.com/yfthcn) · [kaktusdev.net](https://kaktusdev.net)

If NetCalc Pro saves you time, give it a ⭐ on GitHub.
