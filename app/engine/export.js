// Exports: a BOM CSV for spreadsheets, a cut-list CSV, a plain list of
// "part number <tab> quantity" lines to paste into McMaster-Carr's order
// form, and the design as JSON (params only, so it rebuilds exactly).

import { fracIn } from './units.js';

function csvCell(v) {
  if (v == null) return '';
  let s = String(v);
  // Spreadsheet formula guard (=, +, -, @ at the start).
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows) {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function bomCsv(b) {
  const rows = [['Item', 'McMaster part number', 'Quantity', 'Description', 'Unit price (USD)', 'Line total (USD)', 'Notes', 'Link']];
  b.lines.forEach((l, i) => rows.push([i + 1, l.pn || 'TBD', l.qty, l.name, l.unitPrice ?? '', l.total ?? '', l.note || '', l.url || '']));
  for (const p of b.panels) rows.push(['', '(not McMaster)', p.qty, `Deck ${fracIn(p.size[0])} x ${fracIn(p.size[1])} x ${fracIn(p.thickness)} ${p.material}`, '', '', p.notches ? `notch ${fracIn(p.notches.size[0])} square at 4 corners` : '', '']);
  return toCsv(rows);
}

export function cutListCsv(b) {
  const rows = [['Mark', 'Quantity', 'Length (in)', 'Length', 'Length (mm)', 'Profile', 'End work']];
  for (const c of b.cuts) rows.push([c.mark, c.qty, c.length.toFixed(4), fracIn(c.length), (c.length * 25.4).toFixed(1), c.profile, c.ops.join('; ')]);
  rows.push([]);
  rows.push(['Stick', 'Stock length (in)', 'Cuts', 'Offcut (in)']);
  for (const plan of Object.values(b.plans)) {
    plan.sticks.forEach((s, i) => rows.push([i + 1, s.stockLength, s.cuts.map((c) => `${c.mark} ${fracIn(c.length)}`).join(' | '), s.offcut.toFixed(3)]));
  }
  return toCsv(rows);
}

// McMaster's order pad takes a part number and a quantity per line. Lines
// without a part number are left out and listed separately so nothing is
// silently dropped.
export function mcmasterPaste(b) {
  const ok = b.lines.filter((l) => l.pn);
  const missing = b.lines.filter((l) => !l.pn);
  return {
    text: ok.map((l) => `${l.pn}\t${l.qty}`).join('\n'),
    missing: missing.map((l) => l.name),
  };
}

export function designJson(design) {
  return JSON.stringify({ app: 'extrusion-designer', version: 1, template: design.meta.template, params: design.meta.params }, null, 2);
}
