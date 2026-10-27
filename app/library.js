// "My parts" library: STEP files and 2D drawings a person adds for parts
// the catalog doesn't have yet (or to check a placeholder, like a caster's
// mounting height). Everything stays in this browser (IndexedDB): McMaster's
// terms don't allow sharing their CAD files, and the app has no server.
// What can be shared is the catalog entry: numbers only, no geometry.

import { stepInfo, partFromFileName, guessFields, toCatalog } from './engine/stepinfo.js';

const DB = 'extrusion-designer', STORE = 'parts';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n4 = (v) => (v == null || v === "" ? "" : String(Math.round(Number(v) * 1000) / 1000));

function db() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('This browser has no local storage for files.')); return; }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
}
export async function listParts() {
  try { return (await tx('readonly', (s) => s.getAll())) || []; } catch { return []; }
}
const putPart = (p) => tx('readwrite', (s) => s.put(p));
const deletePart = (id) => tx('readwrite', (s) => s.delete(id));

// ---- the tab ------------------------------------------------------------
const KINDS = {
  caster: { label: 'Caster', fields: [['mountHeight', 'Mounting height (floor to where it meets the rail end), in'], ['wheelDia', 'Wheel diameter, in'], ['thread', 'Stem thread', 'text']] },
  'corner-bracket': { label: 'Corner bracket', fields: [['legLength', 'Leg length (from the outside face), in'], ['width', 'Width, in'], ['thickness', 'Thickness, in'], ['holeDia', 'Hole diameter, in'], ['holeFromCorner', 'Hole centre from the outside face, in']] },
  rail: { label: 'Rail (a stock length)', fields: [['lengthIn', 'Length, in'], ['sectionW', 'Section width, in'], ['sectionH', 'Section height, in']] },
  other: { label: 'Other (reference only)', fields: [] },
};

export function mountLibrary(pane, { onChange, onUse }) {
  let drafts = [];
  const urls = new Set();
  const objectUrl = (blob) => { const u = URL.createObjectURL(blob); urls.add(u); return u; };

  async function render() {
    for (const u of urls) URL.revokeObjectURL(u);
    urls.clear();
    const parts = await listParts();
    pane.innerHTML = `
      <p>Add a McMaster part the catalog doesn't have yet, or check one that's still a guess (the casters' mounting height). Drop its <b>STEP file</b> and/or <b>2D drawing (PDF)</b> from the part's McMaster page: the app reads the part number from the file name and the overall size from the STEP file, and you confirm the numbers against the drawing.</p>
      <p class="hint">Files stay in this browser only; they're never uploaded. McMaster's terms don't allow sharing their CAD files. To add a part for everyone, use <b>Copy catalog entry</b> (numbers only) and send it to the owner.</p>
      <label class="dropzone" id="lib-drop">
        <input type="file" id="lib-files" accept=".step,.stp,.STEP,.STP,.pdf,application/pdf" multiple hidden>
        <strong>Drop STEP or PDF files here</strong><span>or click to choose (several at once is fine; files for the same part number are paired)</span>
      </label>
      <div id="lib-drafts">${drafts.map(draftCard).join('')}</div>
      <h2>My parts (${parts.length})</h2>
      ${parts.length ? `<table class="data"><thead><tr><th>Part</th><th>Kind</th><th>Key sizes</th><th>Files</th><th></th></tr></thead><tbody>${parts.map((p) => partRow(p)).join('')}</tbody></table>` : '<p class="hint">Nothing here yet.</p>'}`;
    const input = pane.querySelector('#lib-files');
    input.onchange = () => addFiles([...input.files]);
    const drop = pane.querySelector('#lib-drop');
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles([...e.dataTransfer.files]); };
    pane.querySelectorAll('[data-draft]').forEach((card) => wireDraft(card));
    pane.querySelectorAll('[data-part]').forEach((row) => wireRow(row, parts.find((p) => p.id === row.dataset.part)));
  }

  async function addFiles(files) {
    for (const f of files) {
      const isStep = /\.(step|stp)$/i.test(f.name), isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
      if (!isStep && !isPdf) continue;
      const guess = partFromFileName(f.name);
      let d = drafts.find((x) => guess.pn && x.pn === guess.pn);
      if (!d) { d = { id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, pn: guess.pn, name: guess.name, kind: guessKind(guess.name), files: [], fields: {}, error: '' }; drafts.push(d); }
      if (!d.name && guess.name) d.name = guess.name;
      d.files.push({ name: f.name, type: isStep ? 'step' : 'pdf', blob: f });
      if (isStep) {
        try { d.info = stepInfo(await f.text()); d.fields = { ...guessFields(d.kind, d.info), ...flatten(d.fields) }; d.error = ''; }
        catch (err) { d.error = err.message; }
      }
    }
    render();
  }

  function draftCard(d) {
    const pdf = d.files.find((f) => f.type === 'pdf');
    const f = flatten(d.fields);
    return `<div class="lib-card" data-draft="${d.id}">
      <div class="lib-grid">
        <label>Part number<input name="pn" value="${esc(d.pn)}" placeholder="e.g. 47065T336"></label>
        <label>Name<input name="name" value="${esc(d.name)}"></label>
        <label>Kind<select name="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}"${k === d.kind ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label>
        <label>Price each, USD (optional)<input name="priceUsd" inputmode="decimal" value="${esc(d.priceUsd ?? '')}"></label>
        ${KINDS[d.kind].fields.map(([k, label, type]) => `<label>${label}<input name="f.${k}" ${type === 'text' ? '' : 'inputmode="decimal"'} value="${esc(type === 'text' ? (f[k] ?? (k === 'thread' ? '3/8"-16' : '')) : n4(f[k]))}"></label>`).join('')}
      </div>
      <p class="hint">${d.info ? `From the STEP file (${esc(d.info.unit)}): ${d.info.size.map((v) => n4(v)).join(' x ')} in overall (x, y, z), ${d.info.points} points. These are the part's outside sizes; check each field against the drawing.` : 'No STEP file: type the sizes from the drawing.'}${d.error ? ` <span class="bad-text">${esc(d.error)}</span>` : ''}</p>
      <p class="hint">Files: ${d.files.map((x) => esc(x.name)).join(', ')}</p>
      ${pdf ? `<details open><summary>Drawing</summary><iframe class="lib-pdf" title="2D drawing of ${esc(d.pn)}" src="${objectUrl(pdf.blob)}#view=FitH"></iframe></details>` : ''}
      <div class="row-actions"><button type="button" class="primary" data-act="save">Save to my parts</button><button type="button" data-act="cancel">Cancel</button></div>
    </div>`;
  }

  function wireDraft(card) {
    const d = drafts.find((x) => x.id === card.dataset.draft);
    const read = () => {
      for (const el of card.querySelectorAll('input, select')) {
        if (el.name.startsWith('f.')) d.fields[el.name.slice(2)] = el.value.trim();
        else d[el.name] = el.value.trim();
      }
    };
    card.querySelector('[name=kind]').onchange = () => { read(); d.fields = { ...guessFields(d.kind, d.info) }; render(); };
    card.querySelector('[data-act=cancel]').onclick = () => { drafts = drafts.filter((x) => x !== d); render(); };
    card.querySelector('[data-act=save]').onclick = async () => {
      read();
      const entry = { id: d.id, pn: d.pn.toUpperCase(), name: d.name, kind: d.kind, priceUsd: d.priceUsd === '' || d.priceUsd == null ? null : Number(d.priceUsd), fields: unflatten(d.kind, d.fields), info: d.info || null, files: d.files, added: new Date().toISOString() };
      try { await putPart(entry); } catch (err) { alert(`Couldn't save: ${err.message}`); return; }
      drafts = drafts.filter((x) => x !== d);
      await render();
      onChange();
    };
  }

  function partRow(p) {
    const c = toCatalog(p);
    const sizes = p.kind === 'caster' ? `mount height ${n4(c.mountHeight)}"` : p.kind === 'corner-bracket' ? `legs ${n4(c.legLength)}" x ${n4(c.width)}" wide` : p.kind === 'rail' ? `${n4(c.lengthIn)}" long, ${(c.section || []).map(n4).join(' x ')}"` : '';
    return `<tr data-part="${esc(p.id)}"><td><b>${esc(p.pn || '-')}</b><br><span class="hint">${esc(p.name)}</span></td><td>${esc(KINDS[p.kind]?.label || p.kind)}</td><td>${esc(sizes)}</td>
      <td>${(p.files || []).map((f, i) => `<a href="#" data-file="${i}">${f.type === 'pdf' ? 'Drawing' : 'STEP'}</a>`).join(' · ')}</td>
      <td class="row-actions">${['caster', 'rail'].includes(p.kind) ? '<button type="button" data-act="use">Use</button>' : ''}<button type="button" data-act="copy">Copy catalog entry</button><button type="button" data-act="delete">Delete</button></td></tr>`;
  }

  function wireRow(row, p) {
    row.querySelectorAll('[data-file]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const f = p.files[+a.dataset.file];
      const u = objectUrl(f.blob);
      if (f.type === 'pdf') window.open(u, '_blank', 'noopener');
      else { const l = document.createElement('a'); l.href = u; l.download = f.name; l.click(); }
    }));
    row.querySelector('[data-act=use]')?.addEventListener('click', () => onUse(p));
    row.querySelector('[data-act=copy]').addEventListener('click', async () => {
      const { source, ...part } = toCatalog(p);
      void source;
      const text = JSON.stringify({ [p.pn || p.id]: { ...part, note: `Measured from the McMaster STEP/drawing in Extrusion Designer's parts library on ${p.added.slice(0, 10)}; check before marking verified.` } }, null, 2);
      try { await navigator.clipboard.writeText(text); row.querySelector('[data-act=copy]').textContent = 'Copied'; } catch { prompt('Copy this catalog entry:', text); }
    });
    row.querySelector('[data-act=delete]').addEventListener('click', async () => {
      if (!confirm(`Delete ${p.pn || p.name} and its files from this browser?`)) return;
      await deletePart(p.id);
      await render();
      onChange();
    });
  }

  render();
  return { render };
}

function guessKind(name) {
  const s = name.toLowerCase();
  if (/caster/.test(s)) return 'caster';
  if (/bracket|gusset/.test(s)) return 'corner-bracket';
  if (/rail|extrusion|framing/.test(s)) return 'rail';
  return 'other';
}

// Form fields are flat strings; catalog fields have arrays for sections.
function flatten(f = {}) {
  const out = { ...f };
  if (Array.isArray(f.section)) { out.sectionW = f.section[0]; out.sectionH = f.section[1]; delete out.section; }
  if (Array.isArray(f.footprint)) delete out.footprint;
  return out;
}
function unflatten(kind, f) {
  const num = (v) => (v === '' || v == null ? null : Number(v));
  if (kind === 'rail') return { lengthIn: num(f.lengthIn), section: [num(f.sectionW), num(f.sectionH)] };
  if (kind === 'caster') return { mountHeight: num(f.mountHeight), wheelDia: num(f.wheelDia), thread: f.thread || '3/8"-16' };
  if (kind === 'corner-bracket') return { legLength: num(f.legLength), width: num(f.width), thickness: num(f.thickness), holeDia: num(f.holeDia), holeFromCorner: num(f.holeFromCorner) };
  return {};
}
