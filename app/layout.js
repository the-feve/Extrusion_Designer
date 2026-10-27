// Resizable, movable layout: drag the bars between the settings panel, the
// 3D view and the tabs; "Float" pops the 3D view or the tabs out into a
// window you can drag by its title bar and resize from its corner. Sizes and
// window positions are remembered per browser. Double-click a bar (or press
// Home on it) to reset; arrow keys move a focused bar.

const KEY = 'extrusion-designer.layout.v1';
const root = document.documentElement;
const stage = document.querySelector('.stage');
const els = { viewer: document.getElementById('viewer'), dock: document.getElementById('dock') };
const TITLES = { viewer: '3D view', dock: 'Checks, parts, cut list, drawing, order' };

let state = {};
try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { state = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const notifyResize = () => window.dispatchEvent(new Event('resize'));

// ---- split bars ---------------------------------------------------------
const limits = {
  panel: () => [220, Math.min(640, window.innerWidth - 360)],
  viewer: () => [200, window.innerHeight - 180],
};
function apply() {
  if (state.panel) root.style.setProperty('--panel-w', `${clamp(state.panel, ...limits.panel())}px`);
  else root.style.removeProperty('--panel-w');
  if (state.viewer) root.style.setProperty('--viewer-h', `${clamp(state.viewer, ...limits.viewer())}px`);
  else root.style.removeProperty('--viewer-h');
  notifyResize();
}

for (const bar of document.querySelectorAll('[data-split]')) {
  const which = bar.dataset.split;
  const current = () => (which === 'panel' ? document.querySelector('.panel').getBoundingClientRect().width : els.viewer.getBoundingClientRect().height);
  bar.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    bar.classList.add('dragging');
    const start = which === 'panel' ? e.clientX : e.clientY;
    const from = current();
    const move = (ev) => {
      const d = (which === 'panel' ? ev.clientX : ev.clientY) - start;
      state[which] = clamp(from + d, ...limits[which]());
      apply();
    };
    const up = () => { bar.classList.remove('dragging'); bar.removeEventListener('pointermove', move); save(); };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up, { once: true });
    bar.addEventListener('pointercancel', up, { once: true });
  });
  bar.addEventListener('dblclick', () => { delete state[which]; apply(); save(); });
  bar.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 64 : 16;
    const dir = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (e.key === 'Home') { delete state[which]; apply(); save(); e.preventDefault(); return; }
    if (!dir) return;
    state[which] = clamp(current() + dir * step, ...limits[which]());
    apply(); save(); e.preventDefault();
  });
}

// ---- floating windows ---------------------------------------------------
function float(name, on) {
  const el = els[name];
  const st = state.float?.[name];
  state.float = state.float || {};
  if (on) {
    let bar = el.querySelector(':scope > .float-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'float-bar';
      bar.innerHTML = `<span>${TITLES[name]}</span><button type="button">Dock</button>`;
      bar.querySelector('button').addEventListener('click', () => float(name, false));
      dragBy(bar, el, name);
      el.prepend(bar);
    }
    const r = st || defaultRect(name);
    Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    el.classList.add('floating');
    stage.classList.add(`${name}-out`);
    state.float[name] = { ...r, on: true };
    keepOnScreen(el, name);
    watchSize(el, name);
  } else {
    el.classList.remove('floating');
    el.querySelector(':scope > .float-bar')?.remove();
    for (const k of ['left', 'top', 'width', 'height']) el.style[k] = '';
    stage.classList.remove(`${name}-out`);
    if (state.float[name]) state.float[name].on = false;
  }
  save();
  notifyResize();
}

function defaultRect(name) {
  const w = Math.min(name === 'viewer' ? 720 : 820, window.innerWidth - 40);
  const h = Math.min(name === 'viewer' ? 520 : 560, window.innerHeight - 80);
  return { x: window.innerWidth - w - 24, y: 80, w, h };
}

function keepOnScreen(el, name) {
  const r = el.getBoundingClientRect();
  // Keep the title bar reachable and the window no bigger than the screen.
  const w = Math.min(r.width, window.innerWidth - 16), h = Math.min(r.height, window.innerHeight - 16);
  const x = clamp(r.left, 0, Math.max(0, window.innerWidth - 120));
  const y = clamp(r.top, 0, Math.max(0, window.innerHeight - h - 8));
  Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  Object.assign(state.float[name], { x, y, w, h });
}

function dragBy(bar, el, name) {
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const move = (ev) => {
      el.style.left = `${clamp(ev.clientX - dx, -r.width + 120, window.innerWidth - 120)}px`;
      el.style.top = `${clamp(ev.clientY - dy, 0, window.innerHeight - 40)}px`;
    };
    const up = () => {
      bar.removeEventListener('pointermove', move);
      const now = el.getBoundingClientRect();
      Object.assign(state.float[name], { x: now.left, y: now.top });
      save();
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up, { once: true });
    bar.addEventListener('pointercancel', up, { once: true });
  });
}

// The window's corner handle is CSS `resize: both`; remember the size it's given.
const watched = new WeakSet();
function watchSize(el, name) {
  if (watched.has(el)) return;
  watched.add(el);
  let t = null;
  new ResizeObserver(() => {
    if (!el.classList.contains('floating')) return;
    clearTimeout(t);
    t = setTimeout(() => {
      const r = el.getBoundingClientRect();
      Object.assign(state.float[name], { w: r.width, h: r.height });
      save();
    }, 200);
  }).observe(el);
}

for (const b of document.querySelectorAll('[data-float]')) {
  b.addEventListener('click', () => float(b.dataset.float, !els[b.dataset.float].classList.contains('floating')));
}
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const name of Object.keys(els)) if (els[name].classList.contains('floating') && els[name].contains(document.activeElement)) float(name, false);
});
window.addEventListener('resize', () => { for (const name of Object.keys(els)) if (els[name].classList.contains('floating')) keepOnScreen(els[name], name); });

// Restore, but never float on a phone-size screen.
apply();
if (window.matchMedia('(min-width: 861px)').matches) for (const name of Object.keys(els)) if (state.float?.[name]?.on) float(name, true);
