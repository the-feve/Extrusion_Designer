// Reads what the parts library needs from a STEP file, in the browser: the
// length unit, the bounding box of every CARTESIAN_POINT (converted to
// inches), and the header's file name. It doesn't build geometry; the box
// is the part's overall size, which the person then confirms against the 2D
// drawing. Construction points can sit slightly outside the solid, so
// measured sizes are shown as "from the file, check".

const MM = 25.4;

export function stepInfo(text) {
  if (!/ISO-10303-21/.test(text.slice(0, 200))) throw new Error('Not a STEP file (no ISO-10303-21 header).');
  const header = text.slice(0, text.indexOf('ENDSEC;') + 7);
  const fileName = header.match(/FILE_NAME\s*\(\s*'([^']*)'/)?.[1] || '';
  const schema = header.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/)?.[1] || '';
  const unit = lengthUnit(text);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let points = 0;
  const re = /CARTESIAN_POINT\s*\(\s*'[^']*'\s*,\s*\(\s*([-+0-9.Ee]+)\s*,\s*([-+0-9.Ee]+)\s*,\s*([-+0-9.Ee]+)\s*\)/g;
  for (let m; (m = re.exec(text));) {
    for (let i = 0; i < 3; i++) {
      const v = Number(m[i + 1]);
      if (v < min[i]) min[i] = v;
      if (v > max[i]) max[i] = v;
    }
    points += 1;
  }
  if (!points) throw new Error('No 3D points found in the STEP file.');
  const k = unit.toInch;
  const size = [0, 1, 2].map((i) => round((max[i] - min[i]) * k));
  return {
    fileName, schema, unit: unit.name, points,
    min: min.map((v) => round(v * k)), max: max.map((v) => round(v * k)), size,
    sorted: [...size].sort((a, b) => b - a),
  };
}

function lengthUnit(text) {
  if (/CONVERSION_BASED_UNIT\s*\(\s*'INCH'/i.test(text)) return { name: 'inch', toInch: 1 };
  if (/CONVERSION_BASED_UNIT\s*\(\s*'FOOT'/i.test(text)) return { name: 'foot', toInch: 12 };
  if (/SI_UNIT\s*\(\s*\.MILLI\.\s*,\s*\.METRE\./i.test(text)) return { name: 'mm', toInch: 1 / MM };
  if (/SI_UNIT\s*\(\s*\.CENTI\.\s*,\s*\.METRE\./i.test(text)) return { name: 'cm', toInch: 10 / MM };
  if (/SI_UNIT\s*\(\s*\$\s*,\s*\.METRE\./i.test(text)) return { name: 'm', toInch: 1000 / MM };
  return { name: 'mm (assumed)', toInch: 1 / MM };
}

const round = (v) => Math.round(v * 10000) / 10000;

// McMaster file names start with the part number: "4658N49_T-Slotted
// Framing Rail.STEP", "47065T845_Silver Corner Bracket.pdf".
export function partFromFileName(name) {
  const base = String(name).replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
  const m = base.match(/^(\d{3,6}[A-Z]{1,2}\d{1,5})(?:[_\s-]+(.*))?$/i);
  if (!m) return { pn: '', name: base.replace(/[_]+/g, ' ').trim() };
  return { pn: m[1].toUpperCase(), name: (m[2] || '').replace(/[_]+/g, ' ').trim() };
}

// Best first guess at each kind's catalog fields from the overall size.
// Everything is editable before saving.
export function guessFields(kind, info) {
  if (!info) return {};
  const [a, b, c] = info.sorted;
  if (kind === 'caster') return { mountHeight: a, wheelDia: null, footprint: [round(b), round(c)] };
  if (kind === 'corner-bracket') return { legLength: a, width: c, thickness: 0.25 };
  if (kind === 'rail') return { section: [b, c], lengthIn: a };
  return {};
}

// A library entry (what's kept in the browser) -> a catalog part or stock
// length the engine can use. Rails add a stock length to a matching profile.
export function toCatalog(entry) {
  const f = entry.fields || {};
  const base = { pn: entry.pn || null, name: entry.name || entry.pn || 'My part', priceUsd: entry.priceUsd ?? null, verified: false, source: 'my-library', url: entry.pn ? `https://www.mcmaster.com/${entry.pn}/` : null };
  if (entry.kind === 'caster') {
    return { kind: 'caster', ...base, mount: 'stem', thread: f.thread || '3/8"-16', mountHeight: num(f.mountHeight), wheelDia: num(f.wheelDia), footprint: f.footprint || [1.75, 1.75], swivelRadius: num(f.swivelRadius) };
  }
  if (entry.kind === 'corner-bracket') {
    return { kind: 'corner-bracket', ...base, forProfiles: f.forProfiles || ['1515'], legLength: num(f.legLength), width: num(f.width), thickness: num(f.thickness) ?? 0.25, holeDia: num(f.holeDia) ?? 0.328, holeFromCorner: num(f.holeFromCorner) ?? num(f.legLength) / 2, includes: [] };
  }
  if (entry.kind === 'rail') return { kind: 'rail-stock', ...base, section: f.section, lengthIn: num(f.lengthIn) };
  return { kind: entry.kind || 'other', ...base };
}

const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

// Merge library entries into the shipped catalog data (copy; the original
// is untouched). Library parts win on id clashes only when asked.
export function mergeLibrary(data, entries) {
  const out = JSON.parse(JSON.stringify(data));
  for (const e of entries) {
    const part = toCatalog(e);
    if (part.kind === 'rail-stock') {
      const prof = Object.entries(out.profiles).find(([, p]) => p.section.every((s, i) => Math.abs(s - (part.section?.[i] ?? -1)) < 0.02));
      if (prof && part.lengthIn && !prof[1].stock.some((s) => Math.abs(s.lengthIn - part.lengthIn) < 0.05)) {
        prof[1].stock.push({ lengthIn: round(part.lengthIn), pn: part.pn, priceUsd: part.priceUsd, verified: false, source: 'my-library' });
        prof[1].stock.sort((x, y) => x.lengthIn - y.lengthIn);
      }
      continue;
    }
    if (part.kind === 'caster' && !(part.mountHeight > 0)) continue; // unusable until it has a height
    if (part.kind === 'corner-bracket' && !(part.legLength > 0 && part.width > 0)) continue;
    const id = `lib:${e.id}`;
    out.parts[id] = part;
  }
  return out;
}
