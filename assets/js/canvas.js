// assets/js/canvas.js
let canvas;
const objectsById = new Map();

// ⬇️ add this
export function getCanvas() {
  return initCanvas();
}
export function initCanvas() {
  if (canvas) return canvas;
  canvas = new fabric.Canvas('workCanvas', {
    selection: true,
    preserveObjectStacking: true,
  });
initObjectToolbar();
attachToolbarFollowEvents();
  // 🔴 track whether we're pushing against edges during a drag
  canvas._edgeViolate = false;
enableStraightGuide(2); // threshold in degrees (tweak if you want)

  canvas.on('mouse:down', () => {
    const o = canvas.getActiveObject();
    if (!o) return;
    o._lastLeft = o.left;
    o._lastTop  = o.top;
    o._mStarted = false;
  });
// true if touching edge(s); returns an object of flags
function edgeFlags(o) {
  const br = o.getBoundingRect(true, true);
  return {
    left:   br.left <= 0,
    top:    br.top  <= 0,
    right:  br.left + br.width  >= canvas.getWidth(),
    bottom: br.top  + br.height >= canvas.getHeight(),
  };
}
canvas.on('object:moving', (e) => {
  const o = e.target;
  if (!o) return;

  if (!o._mStarted) {
    o._mStarted = true;
    o._lastLeft = o.left;
    o._lastTop  = o.top;
  }

  clampInsideCanvas(o);

  const overlapped = firstOverlap(o);
  if (overlapped) {
    const nudged = resolveOverlapByPush(o, overlapped);
    if (!nudged) {
      o.set({ left: o._lastLeft, top: o._lastTop });
      o.setCoords();
    }
    o._violateOverlap = true;
  } else {
    o._violateOverlap = false;
    o._lastLeft = o.left;
    o._lastTop  = o.top;
  }

  // 👇 per-edge flags (for drawing just the touched edges)
  o._edges = edgeFlags(o);
  canvas._edges = o._edges;             // remember last for drawing

  canvas.requestRenderAll();
});
canvas.on('object:scaling', (e) => {
  const o = e.target;
  if (!o || o.type !== 'textbox') return;

  if (!o._sStarted) {
    o._sStarted = true;
    o._lastBox = { left: o.left, top: o.top, width: o.width, height: o.height };
  }

  const newW = Math.max(60, Math.min(1000, o.width * o.scaleX));
  const newH = Math.max(20, Math.min(2000, o.height * o.scaleY));

  o.set({ width: newW, height: newH, scaleX: 1, scaleY: 1 });
  clampInsideCanvas(o);
  o.setCoords();

  if (firstOverlap(o)) {
    const b = o._lastBox;
    o.set({ left: b.left, top: b.top, width: b.width, height: b.height });
    o.setCoords();
    o._violateOverlap = true;
  } else {
    o._violateOverlap = false;
    o._lastBox = { left: o.left, top: o.top, width: o.width, height: o.height };
  }

  o._edges = edgeFlags(o);
  canvas._edges = o._edges;

  canvas.requestRenderAll();
});

  canvas.on('object:modified', (e) => {
    const o = e.target;
    if (!o) return;
    o._violateEdge = false;
    o._violateOverlap = false;
    o._mStarted = false;
    canvas._edgeViolate = false;
    canvas.requestRenderAll();
  });

canvas.on('after:render', () => {
  const ctx = canvas.contextContainer;

  // draw canvas edges that are being touched
  const ef = canvas._edges || {};
  if (ef.left || ef.top || ef.right || ef.bottom) {
    ctx.save();
    ctx.strokeStyle = '#ff4d4f';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);

    if (ef.top) {
      ctx.beginPath();
      ctx.moveTo(0.5, 0.5);
      ctx.lineTo(canvas.getWidth() - 0.5, 0.5);
      ctx.stroke();
    }
    if (ef.bottom) {
      const y = canvas.getHeight() - 0.5;
      ctx.beginPath();
      ctx.moveTo(0.5, y);
      ctx.lineTo(canvas.getWidth() - 0.5, y);
      ctx.stroke();
    }
    if (ef.left) {
      ctx.beginPath();
      ctx.moveTo(0.5, 0.5);
      ctx.lineTo(0.5, canvas.getHeight() - 0.5);
      ctx.stroke();
    }
    if (ef.right) {
      const x = canvas.getWidth() - 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0.5);
      ctx.lineTo(x, canvas.getHeight() - 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  // object outlines when violating (unchanged)
  canvas.getObjects().forEach((o) => {
    if (!o.visible || (!o._violateOverlap)) return;
    const br = o.getBoundingRect(true, true);
    ctx.save();
    ctx.strokeStyle = '#ff4d4f';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(br.left, br.top, br.width, br.height);
    ctx.restore();
  });
});


  return canvas;
}
let __currentFontFamily = 'Aero';
const __loadedFonts = new Map();

export function ensureFontLoaded(family, url /* string|null */) {
  if (__loadedFonts.has(family)) return __loadedFonts.get(family);

  if (!url) {
    const p = Promise.resolve();
    __loadedFonts.set(family, p);
    return p;
  }

  const p = (async () => {
    const ff = new FontFace(family, `url(${url})`);
    await ff.load();
    document.fonts.add(ff);

    if (fabric?.util?.clearFabricFontCache) {
      fabric.util.clearFabricFontCache();
    }
 const c = (typeof getCanvas === 'function') ? getCanvas() : canvas;
    if (c && typeof c.requestRenderAll === 'function') c.requestRenderAll();
    return ff;
  })();

  __loadedFonts.set(family, p);
  return p;
}

export function setDefaultFontFamily(family) {
  __currentFontFamily = family || 'Aero';
}

export function getDefaultFontFamily() {
  return __currentFontFamily;
}

export function setFontFamilyForActive(family) {
  const c = (typeof getCanvas === 'function') ? getCanvas() : canvas;  if (!c) return;
  const o = c.getActiveObject();
  if (!o || (o.type !== 'textbox' && o.type !== 'text')) return;

  o.set('fontFamily', family);
  if (typeof o.initDimensions === 'function') o.initDimensions();
  o.setCoords();
  c.requestRenderAll();
}

let __toolbarEl = null;
let __overlayEl = null;

function initObjectToolbar() {
  if (__toolbarEl) return;

  __overlayEl = document.getElementById('canvasOverlay');
  const tpl = document.getElementById('object-toolbar-tpl');
  if (!__overlayEl || !tpl) return;

  const frag = tpl.content.cloneNode(true);
  __toolbarEl = frag.firstElementChild;
  __overlayEl.appendChild(__toolbarEl);

const getActiveSupported = () => {
  const c = (typeof getCanvas === 'function') ? getCanvas() : canvas;
  const o = c?.getActiveObject?.();
  if (!o || !o.emoId) return null;            // must be ours

  // support both text and image kinds
  const isText  = (o.type === 'textbox' || o.type === 'text' || o.emoKind === 'text');
  const isImage = (o.emoKind === 'image');

  return (isText || isImage) ? { c, o, isText, isImage } : null;
};
  // DELETE (syncs with left panel)
  __toolbarEl.querySelector('.btn-trash')?.addEventListener('click', () => {
    const ctx = getActiveSupported(); if (!ctx) return;
    const { o } = ctx;
    const id = o.emoId;
    if (!id) return;
    removeObject(id);
    window.dispatchEvent(new CustomEvent('emo:removed', { detail: { id } }));
    hideObjectToolbar();
  });

  // MIRROR (flip horizontally)
  __toolbarEl.querySelector('.btn-mirror')?.addEventListener('click', () => {
    const ctx = getActiveSupported(); if (!ctx) return;
    const { c, o } = ctx;
    // simplest + robust: toggle flipX
    o.set('flipX', !o.flipX);
    o.setCoords();
    c.requestRenderAll();
    // Toolbar will follow via our follow handlers
  });

  // DUPLICATE (clone visually + sync new card)
__toolbarEl.querySelector('.btn-dup')?.addEventListener('click', () => {
  const ctx = getActiveSupported(); if (!ctx) return;
  const { c, o, isText, isImage } = ctx;

  if (isText) {
    const id = addTextObject({
      text:       o.text || '',
      left:       (o.left || 0) + 20,
      top:        (o.top  || 0) + 20,
      angle:      o.angle || 0,
      fontSize:   o.fontSize || 16,
      fontFamily: o.fontFamily || 'Aero',
      textAlign:  o.textAlign || 'left',
      fill:       o.fill || '#000',
      flipX:      !!o.flipX,
      flipY:      !!o.flipY,
      scaleX:     o.scaleX || 1,
      scaleY:     o.scaleY || 1,
      width:      o.width || undefined
    });
    if (id) {
      selectObject(id);
      c.requestRenderAll();
      window.dispatchEvent(new CustomEvent('emo:added', { detail: { id } }));
    }
    return;
  }

  if (isImage) {
    o.clone((cloned) => {
      const id = crypto.randomUUID();
      cloned.set({
        left: (o.left || 0) + 20,
        top:  (o.top  || 0) + 20,
        emoId: id,
        emoKind: 'image'
      });
      c.add(cloned);
      objectsById.set(id, cloned);
      c.setActiveObject(cloned);
      cloned.setCoords();
      c.requestRenderAll();
      window.dispatchEvent(new CustomEvent('emo:added', { detail: { id } }));
      // make sure toolbar is visible for the duplicate right away
      c.fire('selection:created', { selected: [cloned] });
    }, ['*']);
  }
});


  // SAVE (same as clicking the panel’s ".js-exit-edit" for the selected card)
  __toolbarEl.querySelector('.btn-save')?.addEventListener('click', () => {
    const ctx = getActiveSupported(); if (!ctx) return;
    const { c,o } = ctx;
    const id = o.emoId;
      if (typeof o.exitEditing === 'function') o.exitEditing();
   c.discardActiveObject();

    if (!id) return;
    // Let the panel exit edit mode for the matching card
    window.dispatchEvent(new CustomEvent('emo:save', { detail: { id } }));
    hideObjectToolbar();
      c.requestRenderAll();

  });

  hideObjectToolbar();
}

function showObjectToolbarFor(target) {
  if (!__toolbarEl || !__overlayEl || !target) return;
  const c = (typeof getCanvas === 'function') ? getCanvas() : canvas;
  if (!c) return;

  const vpt  = c.viewportTransform || [1,0,0,1,0,0];
  const zoom = c.getZoom?.() || 1;
  const ac   = target.aCoords || target.oCoords;
  if (!ac) return;

  const topCenterX = (ac.tl.x + ac.tr.x) / 2;
  const topCenterY = Math.min(ac.tl.y, ac.tr.y) - 10; // 10px above box

  const screenX = vpt[4] + topCenterX * zoom;
  const screenY = vpt[5] + topCenterY * zoom;

  __toolbarEl.style.left = `${screenX}px`;
  __toolbarEl.style.top  = `${screenY}px`;
  __toolbarEl.style.display = 'inline-flex';
}

function hideObjectToolbar() {
  if (__toolbarEl) __toolbarEl.style.display = 'none';
}

function attachToolbarFollowEvents() {
  const c = (typeof getCanvas === 'function') ? getCanvas() : canvas;
  if (!c) return;

  const recalc = () => {
    const active = c.getActiveObject?.();
    if (!active || !active.emoId) {                 // allow both text & image if it’s ours
    hideObjectToolbar();
    return;
  }
    showObjectToolbarFor(active);
  };

  c.on('selection:created', ({ selected }) => {
    initObjectToolbar();
    recalc();
  });
  c.on('selection:updated',  recalc);
  c.on('selection:cleared',  hideObjectToolbar);
  c.on('object:moving',      recalc);
  c.on('object:scaling',     recalc);
  c.on('object:rotating',    recalc);
  c.on('object:modified',    recalc);
  c.on('mouse:wheel',        recalc);
  c.on('after:render',       () => {
    if (__toolbarEl?.style.display !== 'none') recalc();
  });
}

// create a text object and place it at a free spot (no overlap, inside edges)
export function addTextObject({
  text = '',
  left = 100,
  top = 100,
  fontSize = 28,
  width = 150,
  align = 'left',
   ...rest   

} = {}) {
  initCanvas();
  const t = new fabric.Textbox(text, {
    left, top, fontSize, width,
    fill: '#000', fontFamily:  getDefaultFontFamily(),
    textAlign: align,
    editable: true, selectable: true,
    splitByGrapheme: false, // normal word wrap
    lockScalingFlip: true,
     ...rest 
  });

  placeAtFreeSpot(t);
  canvas.add(t);
  t.setCoords();
  canvas.setActiveObject(t);
  canvas.requestRenderAll();
canvas.fire('selection:created', { selected: [t] });

  const id = crypto.randomUUID();
  t.set('emoId', id);
  t.set('emoKind', 'text');     
  objectsById.set(id, t);
  return id;
}


export function updateTextObject(id, newText) {
  const o = objectsById.get(id);
  if (!o) return;
  o.set('text', newText ?? '');
  o.setCoords();
  canvas?.requestRenderAll();
}
export function enableStraightGuide(thresholdDeg = 1) {
  initCanvas();
  if (canvas._straightGuideHooked) return;
  canvas._straightGuideHooked = true;

  const angDiff = (a, b) => {
    let d = Math.abs(((a - b) % 360 + 360) % 360);
    if (d > 180) d = 360 - d;
    return d;
  };
  const nearestRight = (ang) => {
    const targets = [0, 90, 180, 270];
    let best = 0, dmin = Infinity;
    for (const t of targets) {
      const d = angDiff(ang, t);
      if (d < dmin) { dmin = d; best = t; }
    }
    return { target: best, delta: dmin };
  };

  canvas.on('object:rotating', (e) => {
    const o = e.target;
    if (!o) return;

    const { target, delta } = nearestRight(o.angle || 0);
    if (delta <= thresholdDeg) {
      const center = o.getCenterPoint();
      // length = scaled width (always)
      const len = Math.max(2,
        typeof o.getScaledWidth === 'function'
          ? o.getScaledWidth()
          : (o.width ?? 0) * (o.scaleX ?? 1)
      );

      // unit vector along width axis (parallel to the guide)
      const rad = (o.angle || 0) * Math.PI / 180;
      const ux = Math.cos(rad), uy = Math.sin(rad);

let fs = Number(o.fontSize);
if (!isFinite(fs) || fs <= 0) fs = 16;          
const offsetPx = (fs * (o.scaleY ?? 1)) / 2 + 4;      let cx = center.x, cy = center.y;
      if (target === 0 || target === 180) {
        // horizontal → move a bit DOWN in screen space
        cy += offsetPx;
      } else {
        // vertical → move a bit LEFT in screen space
        cx -= offsetPx;
      }

      const half = len / 2;
      canvas._straightGuide = {
        x1: cx - ux * half, y1: cy - uy * half,
        x2: cx + ux * half, y2: cy + uy * half,
      };
    } else {
      canvas._straightGuide = null;
    }
    canvas.requestRenderAll();
  });

  canvas.on('mouse:up', () => {
    canvas._straightGuide = null;
    canvas.requestRenderAll();
  });

  canvas.on('after:render', () => {
    const g = canvas._straightGuide;
    if (!g) return;
    const ctx = canvas.contextContainer;
    ctx.save();
    ctx.strokeStyle = '#7A3FF2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.x1 + 0.5, g.y1 + 0.5);
    ctx.lineTo(g.x2 + 0.5, g.y2 + 0.5);
    ctx.stroke();
    ctx.restore();
  });
}


export function removeObject(id) {
  const o = objectsById.get(id);
  if (!o) return;
  canvas?.remove(o);
  objectsById.delete(id);
  canvas?.discardActiveObject();
  canvas?.requestRenderAll();

  // 🔔 notify panels no matter who initiated the remove
  try {
    window.dispatchEvent(new CustomEvent('emo:removed', { detail: { id } }));
  } catch (_) {}
}

export function selectObject(id) {
  const o = objectsById.get(id);
  if (!o) return;
  canvas?.setActiveObject(o);
  canvas?.requestRenderAll();
}
export async function addSvgFromFile(file) {
  const isSvg = file && (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name));
  if (!isSvg) throw new Error('Only SVG files are allowed');

  const c = initCanvas();

  let svgText = await file.text();

  // strip doctype/comments/styles that can trip Fabric
  svgText = svgText
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  if (!/<svg[\s\S]*?>/i.test(svgText)) {
    throw new Error('Invalid SVG file');
  }

  return new Promise((resolve, reject) => {
    try {
      fabric.loadSVGFromString(svgText, (objects, options) => {
        if (!objects || !objects.length) {
          reject(new Error('Empty or unsupported SVG'));
          return;
        }

        const svgObj = fabric.util.groupSVGElements(objects, options);

        // center & scale to fit
        const w = svgObj.width || 1, h = svgObj.height || 1;
        const maxW = c.getWidth() * 0.8, maxH = c.getHeight() * 0.8;
        const s = Math.min(maxW / w, maxH / h, 1);

        svgObj.set({
          left: (c.getWidth() - w * s) / 2,
          top:  (c.getHeight() - h * s) / 2,
          scaleX: s, scaleY: s,
          selectable: true,
          lockScalingFlip: false,
        });

     const id = crypto.randomUUID();
svgObj.set('emoId', id);
svgObj.set('emoKind', 'image');         // ← add this line
c.add(svgObj);
objectsById.set(id, svgObj);            // ← and this
c.setActiveObject(svgObj);
svgObj.setCoords();
c.requestRenderAll();
c.fire('selection:created', { selected: [svgObj] });

resolve(id);                       
        
      });
    } catch (err) {
      reject(err || new Error('Failed to parse SVG'));
    }
  });
}



/* ---------- helpers ---------- */

// keep full bounding box inside canvas
function clampInsideCanvas(o) {
  o.setCoords();
  const br = o.getBoundingRect(true, true);
  let dx = 0, dy = 0;

  if (br.left < 0) dx = -br.left;
  if (br.top < 0) dy = -br.top;

  const overX = (br.left + br.width) - canvas.getWidth();
  const overY = (br.top + br.height) - canvas.getHeight();
  if (overX > 0) dx -= overX;
  if (overY > 0) dy -= overY;

  if (dx || dy) {
    o.left += dx;
    o.top  += dy;
    o.setCoords();
  }
}

// true if touching or beyond any edge
function touchesEdge(o) {
  const br = o.getBoundingRect(true, true);
  return (
    br.left <= 0 ||
    br.top <= 0 ||
    br.left + br.width >= canvas.getWidth() ||
    br.top + br.height >= canvas.getHeight()
  );
}

// first overlapping other object (excluding 'o'), else null
function firstOverlap(o) {
  const a = o.getBoundingRect(true, true);
  const objs = canvas.getObjects().filter(p => p !== o && p.visible);
  for (const bObj of objs) {
    const b = bObj.getBoundingRect(true, true);
    if (rectsOverlap(a, b)) return bObj;
  }
  return null;
}

function rectsOverlap(a, b) {
  return !(
    a.left + a.width  <= b.left ||
    b.left + b.width  <= a.left ||
    a.top  + a.height <= b.top  ||
    b.top  + b.height <= a.top
  );
}

// minimal translation to separate two rects
function resolveOverlapByPush(o, other) {
  const a = o.getBoundingRect(true, true);
  const b = other.getBoundingRect(true, true);

  const pushLeft  = (a.left + a.width) - b.left;
  const pushRight = (b.left + b.width) - a.left;
  const pushUp    = (a.top + a.height) - b.top;
  const pushDown  = (b.top + b.height) - a.top;

  const candidates = [
    { dx: -pushLeft,  dy: 0 },
    { dx:  pushRight, dy: 0 },
    { dx: 0,          dy: -pushUp },
    { dx: 0,          dy:  pushDown },
  ].sort((c1, c2) => (Math.abs(c1.dx)+Math.abs(c1.dy)) - (Math.abs(c2.dx)+Math.abs(c2.dy)));

  for (const c of candidates) {
    const oldLeft = o.left, oldTop = o.top;
    o.left = oldLeft + c.dx;
    o.top  = oldTop  + c.dy;
    clampInsideCanvas(o);
    o.setCoords();
    if (!firstOverlap(o)) return true;
    o.left = oldLeft; o.top = oldTop; o.setCoords();
  }
  return false;
}

/* ----- spawn helper: find a free spot before adding ----- */
function placeAtFreeSpot(o) {
  // measure current size
  canvas.add(o);        // temp add to get accurate bounds
  o.setCoords();
  let br = o.getBoundingRect(true, true);
  canvas.remove(o);

  const pad = 8; // small inner margin
  const cw = canvas.getWidth(), ch = canvas.getHeight();
  const step = 24; // grid step for scanning

  // scan from (pad,pad) across rows to find first free cell
  for (let y = pad; y + br.height + pad <= ch; y += step) {
    for (let x = pad; x + br.width + pad <= cw; x += step) {
      if (rectIsFree(x, y, br.width, br.height)) {
        o.left = x; o.top = y;
        return;
      }
    }
  }

  // fallback: center (clamped)
  o.left = Math.max(pad, Math.min(cw - br.width - pad, (cw - br.width)/2));
  o.top  = Math.max(pad, Math.min(ch - br.height - pad, (ch - br.height)/2));
}

// check if a rectangle would overlap any existing object
function rectIsFree(left, top, width, height) {
  const a = { left, top, width, height };
  return !canvas.getObjects().some(bObj => {
    const b = bObj.getBoundingRect(true, true);
    return rectsOverlap(a, b);
  });
}



export function setTextAlign(id, align /* 'left'|'center'|'right' */) {
  const o = objectsById.get(id);
  if (!o) return;

  // Upgrade to Textbox if needed (preserve props)
  if (o.type !== 'textbox') {
    const props = {
      left: o.left, top: o.top, angle: o.angle,
      fontFamily: o.fontFamily, fontSize: o.fontSize, fill: o.fill,
      text: o.text || '', width: o.width || 260, editable: true, selectable: true,
      lockScalingFlip: true,
    };
    const tb = new fabric.Textbox(props.text, props);
    tb.set('emoId', id);
    canvas.add(tb);
    canvas.remove(o);
    objectsById.set(id, tb);
    canvas.setActiveObject(tb);
  }

  const t = objectsById.get(id); // now guaranteed textbox

  // Ensure there is room to see alignment (give it some min width)
  const minW = Math.max(200, t.width || 0); // tweak to taste
  t.set({ width: minW, textAlign: align });

  // force reflow + redraw
  t.setCoords();
  t.dirty = true;
  canvas.requestRenderAll();
}
// add this export
export function setFontSize(id, size /* number */) {
  const o = objectsById.get(id);
  if (!o) return;

  // reasonable clamp (tweak to taste)
  const fontSize = Math.max(6, Math.min(200, Number(size) || 10));

  // keep visual center stable while reflowing
  const center = o.getCenterPoint();

  o.set({ fontSize });
  // reflow textbox layout cache
  if (typeof o._clearCache === 'function') o._clearCache();
  o._textLines = null;
  o._textLinesOffsets = null;
  if (typeof o.initDimensions === 'function') o.initDimensions();

  // keep inside canvas and avoid overlap (best-effort)
  clampInsideCanvas(o);
  const other = firstOverlap(o);
  if (other) resolveOverlapByPush(o, other);

  o.setPositionByOrigin(center, 'center', 'center');
  o.setCoords();
  o.dirty = true;
  canvas.requestRenderAll();
}
