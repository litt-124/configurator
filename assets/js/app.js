import onTextTab from './panels/text.js';
import onImageTab from './panels/image.js';
import onColorTab from './panels/color.js';
import onProductTab from './panels/product.js';
import { initBackground } from './background.js';
import { initTabsSession } from './tabs-session.js';
import { rehydrateInitialPreview } from './utils.js'; // 👈 add this

const panelLoaders = {
  'pane-product': async () => onProductTab,
  'pane-color':   async () => onColorTab,
  'pane-text':    async () => onTextTab,
  'pane-image':   async () => onImageTab,
  'pane-size':    async () => {
    const m = await import('./panels/size.js');   // ← lazy-load
    return m.default;
  },
};

async function runPanelFor(pane) {
  if (!pane) return;
  const load = panelLoaders[pane.id];
  if (!load) return console.warn('[panel] no handler for', pane.id);
  const handler = await load();
  if (typeof handler !== 'function') {
    console.warn('[panel] handler is not a function for', pane.id, handler);
    return;
  }
  handler(pane);
}
function initWorkspaceDrag({
                             container = '#workCanvasContainer',
                             outerSel  = '.canvas-outer',
                             innerSel  = '.canvas-inner',
                             handleSel = '#canvasMoveHandle',
                             clamp     = 'hard',
                           } = {}) {
  const root   = document.querySelector(container);
  const outer  = root?.querySelector(outerSel);
  const inner  = root?.querySelector(innerSel);
  const handle = root?.querySelector(handleSel);
  if (!root || !outer || !inner || !handle) return;

  // current translate
  let pos = readTranslate(inner); // starts at {0,0} if none
  applyTransform(pos);

  let dragging = false;
  let start = { x: 0, y: 0, mx: 0, my: 0 };

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handle.setPointerCapture?.(e.pointerId);
    dragging = true;
    start = { x: pos.x, y: pos.y, mx: e.clientX, my: e.clientY };
    handle.classList.add('is-grabbing');
  });

  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - start.mx;
    const dy = e.clientY - start.my;

    let nx = start.x + dx;
    let ny = start.y + dy;

    if (clamp === 'hard') {
      const b = computeBounds(outer, inner);
      nx = clamp1(nx, b.minX, b.maxX);
      ny = clamp1(ny, b.minY, b.maxY);
      pos = { x: nx, y: ny };
      requestAnimationFrame(() => {
        applyTransform(pos);
        updateEdgeHighlight(outer, b, pos);
      });
    } else {
      pos = { x: nx, y: ny };
      requestAnimationFrame(() => applyTransform(pos));
    }
  });

  window.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('is-grabbing');
    handle.releasePointerCapture?.(e.pointerId);
    clearEdgeHighlight(outer);
  });

  window.addEventListener('resize', () => {
    const b = computeBounds(outer, inner);
    pos.x = clamp1(pos.x, b.minX, b.maxX);
    pos.y = clamp1(pos.y, b.minY, b.maxY);
    applyTransform(pos);
    updateEdgeHighlight(outer, b, pos);
  });

  // optional keyboard nudges on the handle
  handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 2;
    let changed = true;
    switch (e.key) {
      case 'ArrowLeft':  pos.x -= step; break;
      case 'ArrowRight': pos.x += step; break;
      case 'ArrowUp':    pos.y -= step; break;
      case 'ArrowDown':  pos.y += step; break;
      default: changed = false;
    }
    if (!changed) return;

    if (clamp === 'hard') {
      const b = computeBounds(outer, inner);
      pos.x = clamp1(pos.x, b.minX, b.maxX);
      pos.y = clamp1(pos.y, b.minY, b.maxY);
      applyTransform(pos);
      updateEdgeHighlight(outer, b, pos);
    } else {
      applyTransform(pos);
    }
    e.preventDefault();
  });

  // ---- helpers ----
  function applyTransform(p) {
    inner.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
  }

  // Generalized bounds: supports inner <, =, or > outer
  function computeBounds(outerEl, innerEl) {
    const oW = outerEl.clientWidth;
    const oH = outerEl.clientHeight;
    const iW = innerEl.offsetWidth;
    const iH = innerEl.offsetHeight;

    // Allowed left/top translate so inner stays fully inside:
    // left ∈ [minX, maxX], top ∈ [minY, maxY]
    // If inner is smaller: min=0, max=(outer-inner)  (can move positively)
    // If inner is bigger : min=(outer-inner), max=0  (can move negatively)
    const minX = Math.min(0, oW - iW);
    const maxX = Math.max(0, oW - iW);
    const minY = Math.min(0, oH - iH);
    const maxY = Math.max(0, oH - iH);

    return { minX, maxX, minY, maxY };
  }

  function clamp1(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function readTranslate(el) {
    const m = getComputedStyle(el).transform;
    if (!m || m === 'none') return { x: 0, y: 0 };
    const nums = m.match(/-?\d+\.?\d*/g)?.map(Number) || [];
    if (m.startsWith('matrix3d(') && nums.length === 16) return { x: nums[12] || 0, y: nums[13] || 0 };
    if (m.startsWith('matrix(')   && nums.length === 6)  return { x: nums[4]  || 0, y: nums[5]  || 0 };
    return { x: 0, y: 0 };
  }

  const EPS = 0.5;
  function updateEdgeHighlight(outerEl, b, p) {
    const atLeft   = Math.abs(p.x - b.minX) < EPS;
    const atRight  = Math.abs(p.x - b.maxX) < EPS;
    const atTop    = Math.abs(p.y - b.minY) < EPS;
    const atBottom = Math.abs(p.y - b.maxY) < EPS;

    outerEl.classList.toggle('edge-left', atLeft);
    outerEl.classList.toggle('edge-right', atRight);
    outerEl.classList.toggle('edge-top', atTop);
    outerEl.classList.toggle('edge-bottom', atBottom);
    outerEl.classList.toggle('edge-any', atLeft || atRight || atTop || atBottom);
  }

  function clearEdgeHighlight(outerEl) {
    outerEl.classList.remove('edge-left','edge-right','edge-top','edge-bottom','edge-any');
  }
}



document.addEventListener('DOMContentLoaded', async () => {
  initTabsSession({ tablistSelector: '#headerTabs' });
  initBackground({ root: '#materialSelect', canvas: '#workCanvasContainer' });
  initWorkspaceDrag({
    container: '#workCanvasContainer',
    outerSel:  '.canvas-outer',
    innerSel:  '.canvas-inner',
    handleSel: '#canvasMoveHandle',
  });

  await rehydrateInitialPreview();

  // Initial: prefer session ptab, else active tab button
  let pane = null;
  const ptab = sessionStorage.getItem('ptab');
  if (ptab) pane = document.getElementById(ptab);
  if (!pane) {
    const btn = document.querySelector('#headerTabs .nav-link.active[data-bs-target]');
    const id = btn?.getAttribute('data-bs-target')?.slice(1);
    if (id) pane = document.getElementById(id);
  }
  await runPanelFor(pane);

  document.getElementById('headerTabs')?.addEventListener('shown.bs.tab', async (e) => {
    const targetSelector = e.target.getAttribute('data-bs-target');
    await runPanelFor(document.querySelector(targetSelector));
  });

  document.addEventListener('configurator:tab-activated', async (e) => {
    const id = e.detail?.paneId;
    await runPanelFor(id ? document.getElementById(id) : null);
  });
});
