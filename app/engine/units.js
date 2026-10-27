// Units. Everything inside the engine is in inches (McMaster's 1.5" series is
// an inch system). These helpers only format for people.

export const MM_PER_IN = 25.4;

// Lengths are compared with this tolerance (inches). Cut lengths are rounded
// to 1/32" before grouping, which is finer than a saw holds.
export const EPS = 1e-6;
export const CUT_STEP = 1 / 32;

export function roundTo(x, step) {
  return Math.round(x / step) * step;
}

export function nearlyEqual(a, b, tol = 1e-6) {
  return Math.abs(a - b) <= tol;
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

// 22.5 -> 22-1/2", 22.03125 -> 22-1/32". Denominator up to 32.
export function fracIn(x, maxDen = 32) {
  const sign = x < 0 ? '-' : '';
  x = Math.abs(x);
  let whole = Math.floor(x + 1e-9);
  let num = Math.round((x - whole) * maxDen);
  if (num === maxDen) { whole += 1; num = 0; }
  if (num === 0) return `${sign}${whole}"`;
  const g = gcd(num, maxDen);
  const frac = `${num / g}/${maxDen / g}`;
  return whole ? `${sign}${whole}-${frac}"` : `${sign}${frac}"`;
}

// 30 -> 2' 6"
export function ftIn(x) {
  const ft = Math.floor((x + 1e-9) / 12);
  const rest = x - ft * 12;
  if (!ft) return fracIn(rest);
  return nearlyEqual(rest, 0, 1e-9) ? `${ft}'` : `${ft}' ${fracIn(rest)}`;
}

export function mm(x, digits = 1) {
  return `${(x * MM_PER_IN).toFixed(digits)} mm`;
}

// Parse what a person types: 24, 24.5, 24 1/2, 24-1/2, 2' 6", 2'6, 610mm, 61 cm.
export function parseLength(text) {
  if (typeof text === 'number') return text;
  const s = String(text).trim().toLowerCase().replace(/[”″]/g, '"').replace(/[’′]/g, "'");
  if (!s) return NaN;
  let m = s.match(/^(-?\d*\.?\d+)\s*mm$/);
  if (m) return Number(m[1]) / MM_PER_IN;
  m = s.match(/^(-?\d*\.?\d+)\s*cm$/);
  if (m) return Number(m[1]) * 10 / MM_PER_IN;
  m = s.match(/^(-?\d*\.?\d+)\s*m$/);
  if (m) return Number(m[1]) * 1000 / MM_PER_IN;
  let ft = 0;
  let rest = s;
  m = s.match(/^(\d*\.?\d+)\s*(?:'|ft)\s*(.*)$/);
  if (m) { ft = Number(m[1]); rest = m[2]; }
  rest = rest.replace(/("|in)$/, '').trim();
  if (!rest) return ft * 12;
  m = rest.match(/^(\d+)?[\s-]*(?:(\d+)\/(\d+))?$/);
  if (m && (m[1] || m[2])) {
    const whole = m[1] ? Number(m[1]) : 0;
    const frac = m[2] ? Number(m[2]) / Number(m[3]) : 0;
    return ft * 12 + whole + frac;
  }
  const n = Number(rest);
  return Number.isFinite(n) ? ft * 12 + n : NaN;
}
