/**
 * NetCalc Pro - Number Base Converter
 * BigInt ile çalışır, sınırsız büyüklük destekler.
 */
const NumBase = (() => {

  function clean(str, base) {
    if (typeof str !== 'string') return str;
    let s = str.trim().replace(/[\s_,]/g, '');
    if (s.length === 0) return '';
    if (base === 16 && /^0x/i.test(s)) s = s.slice(2);
    if (base === 2 && /^0b/i.test(s)) s = s.slice(2);
    if (base === 8 && /^0o/i.test(s)) s = s.slice(2);
    return s;
  }

  function parse(str, base) {
    const cleaned = clean(str, base);
    if (cleaned === '') return null;

    const validators = {
      10: /^[0-9]+$/,
      16: /^[0-9a-fA-F]+$/,
      2:  /^[01]+$/,
      8:  /^[0-7]+$/
    };

    if (!validators[base].test(cleaned)) {
      throw new Error(`Invalid ${baseName(base)} character: "${cleaned}"`);
    }

    const prefix = base === 16 ? '0x' : base === 8 ? '0o' : base === 2 ? '0b' : '';
    return BigInt(prefix + cleaned);
  }

  function format(big, base) {
    if (big === null) return '';
    if (big < 0n) throw new Error('Negative numbers not supported');
    return big.toString(base);
  }

  function baseName(b) {
    return { 2: 'binary', 8: 'octal', 10: 'decimal', 16: 'hexadecimal' }[b];
  }

  function convertAll(str, fromBase) {
    const big = parse(str, fromBase);
    if (big === null) return null;

    return {
      dec: big.toString(10),
      hex: big.toString(16).toUpperCase(),
      bin: big.toString(2),
      oct: big.toString(8),
      bigInt: big
    };
  }

  function binGrouped(big) {
    const bin = big.toString(2);
    const padded = bin.padStart(Math.ceil(bin.length / 8) * 8, '0');
    return padded.match(/.{1,8}/g).join(' ');
  }

  return { parse, format, convertAll, binGrouped, baseName };
})();

window.NumBase = NumBase;
