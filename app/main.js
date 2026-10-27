// Page wiring: read the form, build the cart, check it, and fill the 3D
// view, checks, parts list, cut list, drawing and McMaster order tabs.

import { makeCatalog } from './engine/catalog.js';
import { buildCart, CART_DEFAULTS } from './engine/cart.js';
import { validate } from './engine/validate.js';
import { bom } from './engine/bom.js';
import { drawingSvg } from './engine/drawing.js';
import { bomCsv, cutListCsv, mcmasterPaste } from './engine/export.js';
import { fracIn, ftIn, parseLength } from './engine/units.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STORE_KEY = 'extrusion-designer.cart.v1';

const catalogData = await (await fetch('./data/catalog.json')).json();
const catalog = makeCatalog(catalogData);
$('catalog-date').textContent = `Catalog checked ${catalogData.checkedOn}`;

let view = null;
try {
  const { View3D } = await import('./view3d.js');
  view = new View3D($('viewer'));
} catch (err) {
  $('viewer').insertAdjacentHTML('beforeend', `<p class="viewer-hint" style="top:50%;bottom:auto;left:0;right:0;text-align:center">3D view unavailable here (${esc(err.message)}). Everything else works.</p>`);
}

// ---- form <-> params ----------------------------------------------------
const casters = catalog.partsOfKind('caster');
$('caster').innerHTML = casters.map((c) => `<option value="${esc(c.id)}">${esc(c.pn)}: ${esc(c.name)}</option>`).join('') + '<option value="">None (posts stand on the floor)</option>';

function readForm() {
  const custom = $('custom-heights').checked;
  const n = Number($('shelves').value) || 0;
  const heights = custom ? [...$('shelf-heights').querySelectorAll('input')].map((i) => i.value) : null;
  return {
    width: $('width').value, length: $('length').value, height: $('height').value,
    caster: $('caster').value || null,
    shelves: n,
    shelfHeights: heights && heights.length === n ? heights : null,
    decks: { top: $('deck-top').checked, shelves: $('deck-shelves').checked, bottom: $('deck-bottom').checked },
    deckThickness: $('deck-thickness').value,
    bottomLift: $('bottom-lift').value.trim() || null,
    kerf: $('kerf').value,
  };
}

function writeForm(p) {
  const q = { ...CART_DEFAULTS, ...p };
  $('width').value = q.width; $('length').value = q.length; $('height').value = q.height;
  $('caster').value = q.caster ?? '';
  $('shelves').value = q.shelves;
  $('custom-heights').checked = Array.isArray(q.shelfHeights);
  $('deck-top').checked = q.decks?.top !== false; $('deck-shelves').checked = q.decks?.shelves !== false; $('deck-bottom').checked = q.decks?.bottom !== false;
  $('deck-thickness').value = q.deckThickness ?? '3/4';
  $('bottom-lift').value = q.bottomLift ?? '';
  $('kerf').value = q.kerf ?? '1/8';
  syncShelfInputs(q.shelfHeights);
}

// Custom shelf heights: one box per shelf, prefilled with the even spacing.
function syncShelfInputs(values) {
  const n = Number($('shelves').value) || 0;
  const box = $('shelf-heights');
  box.hidden = !$('custom-heights').checked || n === 0;
  const cur = [...box.querySelectorAll('input')].map((i) => i.value);
  let even = [];
  try { even = buildCart(catalog, { ...readFormBasic(), shelves: n, shelfHeights: null }).levels?.slice(1, -1).map((l) => l.railTop) || []; } catch { /* sizes not valid yet */ }
  box.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const v = values?.[i] ?? cur[i] ?? (even[i] != null ? String(even[i]) : '');
    box.insertAdjacentHTML('beforeend', `<label>Shelf ${i + 1}<input inputmode="decimal" value="${esc(v)}" aria-label="Shelf ${i + 1} height, floor to top of rails"></label>`);
  }
  if (n) box.insertAdjacentHTML('beforeend', '<p class="hint">Floor to the top of each shelf\'s rails.</p>');
}
function readFormBasic() {
  return { width: $('width').value, length: $('length').value, height: $('height').value, caster: $('caster').value || null, bottomLift: $('bottom-lift').value.trim() || null, deckThickness: $('deck-thickness').value };
}

// ---- build + render -------------------------------------------------------
let current = null;
function update({ fit = false } = {}) {
  const raw = readForm();
  for (const id of ['width', 'length', 'height', 'deck-thickness', 'kerf']) $(id).classList.toggle('bad', !Number.isFinite(parseLength($(id).value)));
  const design = buildCart(catalog, raw);
  const check = validate(design);
  const kerf = parseLength(raw.kerf);
  const b = design.members.length ? bom(design, { kerf: Number.isFinite(kerf) ? kerf : 0.125 }) : null;
  current = { raw, design, check, bom: b };
  save(raw);
  renderStatus(check, b);
  renderChecks(check);
  renderBom(b);
  renderCuts(b);
  renderDrawing(design, b);
  renderOrder(b);
  if (view) { view.show(design, { fit }); view.highlight([]); }
}

function renderStatus(check, b) {
  const el = $('status');
  el.className = `status ${check.ok ? 'ok' : 'bad'}`;
  const head = check.ok ? '<strong class="ok-text">Buildable</strong>' : `<strong class="bad-text">${check.errors} problem${check.errors === 1 ? '' : 's'}</strong>`;
  const parts = b ? `<div>${b.cuts.reduce((a, c) => a + c.qty, 0)} rail pieces from ${b.lines.find((l) => l.kind === 'rail')?.qty ?? 0} sticks · ${b.lines.filter((l) => l.kind !== 'rail').reduce((a, l) => a + l.qty, 0)} hardware parts</div>` : '';
  const msg = check.ok ? '' : `<div>${esc(check.issues.find((i) => i.level === 'error')?.msg)}</div>`;
  el.innerHTML = head + parts + msg;
}

function renderChecks(check) {
  // Group repeats (8 brackets with the same problem) into one line.
  const groups = new Map();
  for (const i of check.issues) {
    const key = `${i.level}|${i.code}`;
    if (!groups.has(key)) groups.set(key, { ...i, ids: [...(i.ids || [])], count: 0 });
    const g = groups.get(key);
    g.count += 1;
    if (g.count > 1) g.ids.push(...(i.ids || []));
  }
  const order = { error: 0, warn: 1, info: 2 };
  const list = [...groups.values()].sort((a, b) => order[a.level] - order[b.level]);
  const summary = check.ok
    ? '<p>No clashes. Every rail end sits flat on the post beside it, every joint has a bracket, and every bracket hole lands on a T-slot.</p>'
    : '<p>Fix the red items. Click one to see the parts in the 3D view.</p>';
  $('pane-checks').innerHTML = summary + `<ul class="issues">${list.map((g, n) => `<li class="${g.level}" data-n="${n}">${esc(g.msg)}${g.count > 1 ? ` <span class="more">(and ${g.count - 1} more like it)</span>` : ''}</li>`).join('')}</ul>`;
  $('pane-checks').querySelectorAll('li').forEach((li) => li.addEventListener('click', () => view?.highlight(list[+li.dataset.n].ids)));
}

const money = (v) => (v == null ? '<span class="tbd">check price</span>' : `$${v.toFixed(2)}`);

function renderBom(b) {
  if (!b) { $('pane-bom').innerHTML = '<p>Fix the size first.</p>'; return; }
  const rows = b.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${l.pn ? `<a href="https://www.mcmaster.com/${esc(l.pn)}/" target="_blank" rel="noopener">${esc(l.pn)}</a>` : '<span class="tbd">TBD</span>'}</td><td class="num">${l.qty}</td><td>${esc(l.name)}${l.verified === false ? ' <span class="tbd" title="Not checked on mcmaster.com yet">(unverified)</span>' : ''}<br><span class="hint">${esc(l.note)}</span></td><td class="num">${money(l.unitPrice)}</td><td class="num">${l.total == null ? '' : `$${l.total.toFixed(2)}`}</td></tr>`).join('');
  const panels = b.panels.map((p) => `<tr><td></td><td>not McMaster</td><td class="num">${p.qty}</td><td>Deck ${fracIn(p.size[0])} x ${fracIn(p.size[1])} x ${fracIn(p.thickness)} ${esc(p.material)}${p.notches ? `, notched ${fracIn(p.notches.size[0])} square at the 4 corners for the posts` : ''}<br><span class="hint">${esc(p.names.join(', '))}</span></td><td></td><td></td></tr>`).join('');
  $('pane-bom').innerHTML = `
    <div class="row-actions"><button type="button" id="dl-bom">Download parts list (CSV)</button></div>
    <table class="data"><thead><tr><th>#</th><th>McMaster #</th><th class="num">Qty</th><th>Description</th><th class="num">Each</th><th class="num">Total</th></tr></thead>
    <tbody>${rows}${panels}</tbody>
    <tfoot><tr><td colspan="5">Known total${b.missingPrices ? ` (${b.missingPrices} line${b.missingPrices === 1 ? '' : 's'} still need a price)` : ''}</td><td class="num">$${b.total.toFixed(2)}</td></tr></tfoot></table>
    <p class="hint">Brackets include their screws and end-feed nuts. Prices change: check them on McMaster before ordering.</p>`;
  $('dl-bom').onclick = () => download('extrusion-designer-parts.csv', bomCsv(b), 'text/csv');
}

function renderCuts(b) {
  if (!b) { $('pane-cuts').innerHTML = ''; return; }
  const rows = b.cuts.map((c) => `<tr><td><span class="mark">${c.mark}</span></td><td class="num">${c.qty}</td><td>${fracIn(c.length)} <span class="hint">(${ftIn(c.length)}, ${(c.length * 25.4).toFixed(1)} mm)</span></td><td>${esc(c.roles.map((r) => ({ post: 'posts', 'rail-x': 'front and back rails', 'rail-y': 'side rails' }[r] || r)).join(', '))}</td><td>${esc(c.ops.join('; '))}</td></tr>`).join('');
  const sticks = Object.values(b.plans).flatMap((p) => p.sticks.map((s) => `<div class="stick" title="Offcut ${fracIn(s.offcut)}">${s.cuts.map((c) => `<span style="width:${(c.length / s.stockLength) * 100}%">${c.mark} ${fracIn(c.length)}</span>`).join('')}</div>`));
  const plan = Object.values(b.plans)[0];
  $('pane-cuts').innerHTML = `
    <div class="row-actions"><button type="button" id="dl-cuts">Download cut list (CSV)</button></div>
    <table class="data"><thead><tr><th>Mark</th><th class="num">Qty</th><th>Length</th><th>Used for</th><th>End work</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>Cutting plan</h2>
    <p class="hint">${plan ? `${plan.sticks.length} sticks of ${plan.stockLength / 12} ft, ${fracIn(plan.kerf)} saw kerf between pieces. Striped = offcut.` : ''}</p>
    <div class="sticks">${sticks.join('')}</div>`;
  $('dl-cuts').onclick = () => download('extrusion-designer-cut-list.csv', cutListCsv(b), 'text/csv');
}

function renderDrawing(design, b) {
  const svg = drawingSvg(design, { bom: b || undefined });
  $('drawing').innerHTML = svg;
  $('dl-svg').onclick = () => download('extrusion-designer-drawing.svg', svg, 'image/svg+xml');
}

function renderOrder(b) {
  if (!b) { $('pane-order').innerHTML = ''; return; }
  const paste = mcmasterPaste(b);
  $('pane-order').innerHTML = `
    <ol class="steps">
      <li>Copy the list below (part number, a tab, then quantity on each line).</li>
      <li>On <a href="https://www.mcmaster.com/" target="_blank" rel="noopener">mcmaster.com</a>, open <b>Order</b> and use <b>Paste products and quantities</b>.</li>
      <li>Check each line on McMaster (lengths, prices, stock) before you place the order.</li>
    </ol>
    <textarea class="paste" id="paste" readonly>${esc(paste.text)}</textarea>
    <div class="row-actions"><button type="button" class="primary" id="copy-paste">Copy for McMaster</button></div>
    ${paste.missing.length ? `<p class="tbd">Not included (no part number yet): ${esc(paste.missing.join('; '))}</p>` : ''}
    <p class="hint">Decks aren't from McMaster: cut them from a sheet (see the parts list). Rails come as 10 ft sticks for you to cut; McMaster doesn't cut this smooth rail to length.</p>`;
  $('copy-paste').onclick = () => copy(paste.text, 'Copied the McMaster list');
}

// ---- saving, sharing ------------------------------------------------------
function save(raw) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(raw)); } catch { /* private mode */ }
}
function loadSaved() {
  const hash = new URLSearchParams(location.hash.slice(1)).get('d');
  if (hash) { try { return JSON.parse(decodeURIComponent(escape(atob(hash)))); } catch { /* bad link */ } }
  try { const s = localStorage.getItem(STORE_KEY); if (s) return JSON.parse(s); } catch { /* none */ }
  return null;
}
function shareUrl() {
  const d = btoa(unescape(encodeURIComponent(JSON.stringify(readForm()))));
  return `${location.origin}${location.pathname}#d=${d}`;
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch { $('paste')?.select(); toast('Select and copy the text'); }
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 1800);
}

// ---- events ---------------------------------------------------------------
let timer = null;
const soon = () => { clearTimeout(timer); timer = setTimeout(() => update(), 150); };
document.querySelector('.panel').addEventListener('input', (e) => {
  if (e.target.id === 'shelves' || e.target.id === 'custom-heights') syncShelfInputs();
  soon();
});
document.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
  const el = $('shelves');
  el.value = Math.max(0, Math.min(8, (Number(el.value) || 0) + Number(b.dataset.step)));
  syncShelfInputs();
  update();
}));
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => view?.setView(b.dataset.view)));
$('show-decks').addEventListener('change', (e) => view?.setDecksVisible(e.target.checked));
// Exploded view: the button eases parts apart (or back); the slider sets how far.
$('explode').addEventListener('click', () => {
  if (!view) return;
  const on = $('explode').getAttribute('aria-pressed') !== 'true';
  $('explode').setAttribute('aria-pressed', String(on));
  document.querySelector('.explode-amount').hidden = !on;
  view.animateExplode(on ? Number($('explode-amount').value) : 0);
});
$('explode-amount').addEventListener('input', (e) => view?.setExplode(Number(e.target.value)));
document.querySelectorAll('[role="tab"]').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('[role="tab"]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
  document.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== t.dataset.tab; });
}));
$('share').onclick = () => copy(shareUrl(), 'Link copied');
$('save').onclick = () => download('cart-design.json', JSON.stringify({ app: 'extrusion-designer', version: 1, template: 'cart', params: readForm() }, null, 2), 'application/json');
$('load').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    writeForm(j.params || j);
    update({ fit: true });
  } catch { toast('That file is not a saved design'); }
  e.target.value = '';
};
$('print-drawing').onclick = () => window.print();

writeForm(loadSaved() || {});
update({ fit: true });
// For debugging from the console and for the screenshot script.
window.extrusionDesigner = { get view() { return view; }, get current() { return current; } };
