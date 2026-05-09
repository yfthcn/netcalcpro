/**
 * NetCalc Pro - UI Yardımcıları
 */

const UI = {
  $(sel, parent = document) {
    return parent.querySelector(sel);
  },

  $$(sel, parent = document) {
    return Array.from(parent.querySelectorAll(sel));
  },

  el(tag, props = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'attrs') Object.entries(v).forEach(([ak, av]) => e.setAttribute(ak, av));
      else e[k] = v;
    }
    for (const c of children) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  },

  showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.classList.add('visible');
    } else {
      el.classList.remove('visible');
      el.textContent = '';
    }
  },

  copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓ Copied';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = orig;
          btn.classList.remove('copied');
        }, 1200);
      }
    }).catch(() => {});
  },

  renderBinaryHighlighted(binaryStr, networkBits) {
    // 192.168.1.0/24 için ilk 24 bit network, geri kalan host
    // binaryStr formatı: "11000000.10101000.00000001.00000000"
    const container = document.createElement('div');
    container.className = 'binary-display';

    let bitCount = 0;
    const octets = binaryStr.split('.');
    octets.forEach((octet, oi) => {
      const octetSpan = document.createElement('span');
      octetSpan.className = 'binary-octet';
      for (let i = 0; i < octet.length; i++) {
        const bit = document.createElement('span');
        bit.className = 'binary-bit ' + (bitCount < networkBits ? 'network' : 'host');
        bit.textContent = octet[i];
        octetSpan.appendChild(bit);
        bitCount++;
      }
      container.appendChild(octetSpan);
      if (oi < octets.length - 1) {
        const dot = document.createElement('span');
        dot.className = 'binary-dot';
        dot.textContent = '.';
        container.appendChild(dot);
      }
    });
    return container;
  },

  /**
   * Detay satırı oluştur - kopyala butonlu
   */
  detailRow(label, value, opts = {}) {
    const wrap = document.createDocumentFragment();
    const lbl = document.createElement('div');
    lbl.textContent = label;
    const val = document.createElement('div');

    if (opts.html) {
      val.innerHTML = '';
      if (opts.html instanceof Node) val.appendChild(opts.html);
      else val.innerHTML = opts.html;
    } else {
      val.textContent = value;
    }

    if (opts.copy && value) {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.style.marginLeft = '10px';
      copyBtn.addEventListener('click', () => UI.copyToClipboard(value, copyBtn));
      val.appendChild(copyBtn);
    }

    wrap.appendChild(lbl);
    wrap.appendChild(val);
    return wrap;
  },

  detailSection(title, rows) {
    const sec = document.createElement('div');
    sec.className = 'detail-section';
    const hdr = document.createElement('div');
    hdr.className = 'detail-header';
    hdr.textContent = title;
    sec.appendChild(hdr);

    const grid = document.createElement('div');
    grid.className = 'detail-rows';
    for (const r of rows) grid.appendChild(r);
    sec.appendChild(grid);
    return sec;
  },

  card({ title, value, sub, large = false, accent = true }) {
    const c = document.createElement('div');
    c.className = 'card' + (accent ? ' card-accent' : '');
    const head = document.createElement('div');
    head.className = 'card-header';
    const t = document.createElement('div');
    t.className = 'card-title';
    t.textContent = title;
    head.appendChild(t);
    c.appendChild(head);

    const v = document.createElement('div');
    v.className = 'card-value' + (large ? ' large' : '');
    v.textContent = value;
    c.appendChild(v);

    if (sub) {
      const s = document.createElement('div');
      s.className = 'card-sub';
      s.textContent = sub;
      c.appendChild(s);
    }
    return c;
  },

  formatNumber(n) {
    if (typeof n === 'string') return n;
    return n.toLocaleString('en-US');
  }
};
