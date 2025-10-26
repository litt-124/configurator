// panels/color.js
export default function onColorTab(pane) {
  if (!pane || pane.dataset.inited === '1') return;
  pane.dataset.inited = '1';

  const form = pane.querySelector('#colorForm');
  if (!form) return;

  function getCanvasWrapper() {
    // Prefer Fabric's wrapper (created after fabric.Canvas init)
    const wrap = document.querySelector('#workCanvasContainer .canvas-container');
    if (wrap) return wrap;
    // Fallback: your inner frame if Fabric hasn't wrapped yet
    return document.querySelector('#workCanvasContainer .canvas-inner');
  }

  function setCanvasBg(url) {
    const wrap = getCanvasWrapper();
    if (!wrap) return;
    wrap.style.backgroundImage = url ? `url("${url}")` : '';
    wrap.style.backgroundRepeat = 'no-repeat';
    wrap.style.backgroundPosition = 'center';
    wrap.style.backgroundSize = 'cover'; // tweak to 'contain' if you like
  }

  function resolveSwatchUrl(fromEl) {
    // 1) explicit data attribute wins
    const head = fromEl.closest('.product-head');
    const explicit = head?.dataset?.bg;
    if (explicit) return explicit;

    // 2) use the small thumb and upsize 64x64 → 640x480 if present
    const thumb = head?.querySelector('img.thumb');
    if (thumb?.src) {
      const upsized = thumb.src.replace(/(^|[^0-9])64x64([^0-9]|$)/, '$1640x480$2');
      return upsized || thumb.src;
    }

    // 3) fallback: look inside the collapse body for a larger image
    const item = fromEl.closest('.accordion-item');
    const big = item?.querySelector('.media-grid img');
    if (big?.src) return big.src;

    return null;
  }

  // one simple listener: ANY click inside the form updates bg if we can resolve a swatch
  form.addEventListener('click', (e) => {
    const target =
      e.target.closest('.form-check-input[name="color"]');

    if (!target) return;

    const url = resolveSwatchUrl(target);
    if (url) setCanvasBg(url);
  });

  // also react to keyboard selection / programmatic changes
  form.addEventListener('change', (e) => {
    const radio = e.target.closest('.form-check-input[name="color"]');
    if (!radio) return;
    const url = resolveSwatchUrl(radio);
    if (url) setCanvasBg(url);
  });
}
