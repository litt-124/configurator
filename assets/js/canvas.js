// assets/js/canvas.js
let canvas;
const objectsById = new Map();
let canvasMask = null;

let bgRect = null;
let currentBgUrl = null;
let bgImage = null;

export function getCurrentBgUrl() {
  return currentBgUrl;
}

export function setCanvasBgPatternFromUrl(url) {
  const c = initCanvas();

  // Clear background
  if (!url) {
    currentBgUrl = null;

    if (bgImage) {
      c.remove(bgImage);
      bgImage = null;
    }
    // keep bgRect if you use it for layout; just make it transparent
    if (bgRect) {
      bgRect.set({ fill: 'transparent' });
    }

    c.requestRenderAll();
    return;
  }

  currentBgUrl = url;

  fabric.Image.fromURL(
      url,
      (img) => {
        const cw = c.getWidth();
        const ch = c.getHeight();

        const srcW = img.width || img.getElement()?.naturalWidth || 1;
        const srcH = img.height || img.getElement()?.naturalHeight || 1;

        // background-size: cover
        const scale = Math.max(cw / srcW, ch / srcH);

        img.set({
          left: cw / 2,
          top:  ch / 2,
          originX: 'center',
          originY: 'center',
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
        });

        img._isLayout = true; // 👈 so your overlap logic ignores it

        // If we already had a bgImage, replace it
        if (bgImage) {
          c.remove(bgImage);
        }
        bgImage = img;
        c.add(bgImage);
        c.sendToBack(bgImage);

        // Optional: keep bgRect purely as a layout helper
        if (bgRect) {
          bgRect.set({
            width: cw,
            height: ch,
            left: 0,
            top: 0,
            selectable: false,
            evented: false,
            fill: 'transparent',
          });
          bgRect._isLayout = true;
          c.sendToBack(bgRect);
        }

        c.requestRenderAll();
      },
      { crossOrigin: 'anonymous' }
  );
}


export function resetBackgroundCornerRadius() {
  if (!canvas || !bgRect) return;
  bgRect.set({ rx: 0, ry: 0 });
  bgRect.setCoords();
  canvas.requestRenderAll();
}
export function setCanvasMaskFromSvgUrl(url) {
  const c = initCanvas();

  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('No SVG URL provided for canvas mask'));
      return;
    }

    fabric.loadSVGFromURL(url, (objects, options) => {
      try {
        if (!objects || !objects.length) {
          reject(new Error('Mask SVG is empty or invalid'));
          return;
        }

        const mask = fabric.util.groupSVGElements(objects, options);

        const cw = c.getWidth();
        const ch = c.getHeight();
        const w  = mask.width  || 1;
        const h  = mask.height || 1;
        const scale = Math.min(cw / w, ch / h);

        mask.set({
          originX: 'center',
          originY: 'center',
          left: cw / 2,
          top:  ch / 2,
          scaleX: scale,
          scaleY: scale,
          absolutePositioned: true,
        });

        mask._kind = 'svg';  // 👈 mark as SVG mask

        canvasMask = mask;
        c.clipPath = mask;
        c.requestRenderAll();
        resolve(mask);
      } catch (e) {
        reject(e || new Error('Failed to build mask from SVG'));
      }
    });
  });
}
// 🔥 Rounded-rectangle clipPath used for "Rectangle + rounded corners"
export function setRoundedRectMask(percent) {
  const c = initCanvas();
  if (!c) return;

  const cw = c.getWidth();
  const ch = c.getHeight();

  // clamp 0–100 → 0–1
  const p = Math.max(0, Math.min(100, Number(percent) || 0)) / 100;

  const maxR = Math.min(cw, ch) / 2;
  const r    = maxR * p;

  const mask = new fabric.Rect({
    originX: 'center',
    originY: 'center',
    left: cw / 2,
    top:  ch / 2,
    width: cw,
    height: ch,
    rx: r,
    ry: r,
    absolutePositioned: true,
  });

  mask._kind        = 'roundedRect';
  mask._roundedPct  = p; // store ratio so we can refit on resize

  canvasMask = mask;
  c.clipPath = mask;
  c.requestRenderAll();
}

export function refitCanvasMaskToCanvas() {
  const c = canvas;
  if (!c || !canvasMask) return;

  const cw = c.getWidth();
  const ch = c.getHeight();

  // Rounded-rect mask (rectangle with rounded corners)
  if (canvasMask._kind === 'roundedRect') {
    const p = typeof canvasMask._roundedPct === 'number'
        ? canvasMask._roundedPct
        : 1;

    const maxR = Math.min(cw, ch) / 2;
    const r    = maxR * p;

    canvasMask.set({
      originX: 'center',
      originY: 'center',
      left: cw / 2,
      top:  ch / 2,
      width: cw,
      height: ch,
      rx: r,
      ry: r,
    });

  } else {
    // Default SVG mask: keep your previous logic
    const w = canvasMask.width  || 1;
    const h = canvasMask.height || 1;
    const scale = Math.min(cw / w, ch / h);

    canvasMask.set({
      originX: 'center',
      originY: 'center',
      left: cw / 2,
      top:  ch / 2,
      scaleX: scale,
      scaleY: scale,
    });
  }

  canvasMask.setCoords();
  c.requestRenderAll();
}


export function clearCanvasMask() {
  const c = initCanvas();
  c.clipPath = null;
  canvasMask = null;
  c.requestRenderAll();
}

export function getCanvas() {
  return initCanvas();
}
export function refitBgPatternToCanvas() {
  const c = canvas;
  if (!c) return;

  const cw = c.getWidth();
  const ch = c.getHeight();

  // Keep layout rect in sync if you still use it
  if (bgRect) {
    bgRect.set({
      width: cw,
      height: ch,
      left: 0,
      top: 0,
    });
    bgRect.setCoords();
  }

  if (!bgImage) {
    c.requestRenderAll();
    return;
  }

  const srcW = bgImage.width  || bgImage.getElement()?.naturalWidth  || 1;
  const srcH = bgImage.height || bgImage.getElement()?.naturalHeight || 1;

  const scale = Math.max(cw / srcW, ch / srcH);

  bgImage.set({
    left: cw / 2,
    top:  ch / 2,
    originX: 'center',
    originY: 'center',
    scaleX: scale,
    scaleY: scale,
  });

  bgImage.setCoords();
  c.sendToBack(bgImage);
  c.requestRenderAll();
}



export function initCanvas() {
  if (canvas) {
    return canvas;}
  canvas = new fabric.Canvas('workCanvas', {
    selection: true,
    preserveObjectStacking: true,
  });
  canvas.uniformScaling = true;

  initObjectToolbar();
  attachToolbarFollowEvents();
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
  // canvas.on('object:scaling', (e) => {
  //   const o = e.target;
  //   if (!o || o.type !== 'textbox') return;
  //
  //   if (!o._sStarted) {
  //     o._sStarted = true;
  //     o._lastBox = { left: o.left, top: o.top, width: o.width, height: o.height };
  //   }
  //
  //   const newW = Math.max(60, Math.min(1000, o.width * o.scaleX));
  //   const newH = Math.max(20, Math.min(2000, o.height * o.scaleY));
  //
  //   o.set({ width: newW, height: newH, scaleX: 1, scaleY: 1 });
  //   clampInsideCanvas(o);
  //   o.setCoords();
  //
  //   if (firstOverlap(o)) {
  //     const b = o._lastBox;
  //     o.set({ left: b.left, top: b.top, width: b.width, height: b.height });
  //     o.setCoords();
  //     o._violateOverlap = true;
  //   } else {
  //     o._violateOverlap = false;
  //     o._lastBox = { left: o.left, top: o.top, width: o.width, height: o.height };
  //   }
  //
  //   o._edges = edgeFlags(o);
  //   canvas._edges = o._edges;
  //
  //   canvas.requestRenderAll();
  // });

  canvas.on('object:modified', (e) => {
    const o = e.target;
    if (!o) return;

    if ((o.type === 'textbox' || o.type === 'text') && typeof o.fontSize === 'number') {
      // uniformScaling is on, so scaleX ≈ scaleY
      const scale = o.scaleY || o.scaleX || 1;
      if (scale && scale !== 1) {
        const newSize = o.fontSize * scale;

        o.set({ scaleX: 1, scaleY: 1 });
        applyFontSize(o, newSize);
      }
    }

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
  console.log(999)
// inside initCanvas(), right after canvas = new fabric.Canvas(...)
  if (!canvas._maskLoaded && window.__CANVAS_MASK_URL__) {
    canvas._maskLoaded = true;
    console.log("set enq enummm")
    setCanvasMaskFromSvgUrl(window.__CANVAS_MASK_URL__)
        .catch(err => console.error('Canvas mask failed:', err));
  }
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
    if (!o || !o.emoId || !o.canvas) return null;

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
    const id = o.emoId;
    if (id) {
      window.dispatchEvent(new CustomEvent('emo:transform', { detail: { id } }));
    }  });

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
        cloned._svgSource = o._svgSource;
        cloned._imageKind = o._imageKind;
        cloned._imageSrc  = o._imageSrc;
        window.dispatchEvent(new CustomEvent('emo:added', { detail: { id } }));
        // make sure toolbar is visible for the duplicate right away
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

  c.on('selection:created', ({}) => {
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
                                left = null,
                                top  = null,
                                fontSize = 28,
                                align = 'left',
                                fontFamily = getDefaultFontFamily(),
                                ...rest
                              } = {}) {
  const c = initCanvas();
  if (!c) return null;

  const t = new fabric.Text(text, {
    left: 0,
    top:  0,
    fontSize,
    fill: '#000',
    fontFamily,
    textAlign: align,
    editable: true,
    selectable: true,
    splitByGrapheme: false,
    lockScalingFlip: true,
    ...rest,
  });

  // add first so Fabric can measure it properly
  c.add(t);
  enforceUniformScalingControls(t);
  t.setCoords();

  let lx = left;
  let ty = top;

  if (lx == null || ty == null) {
    const cw = c.getWidth();
    const ch = c.getHeight();
    const br = t.getBoundingRect(true, true);

    if (lx == null) lx = (cw - br.width) / 2;
    if (ty == null) ty = (ch - br.height) / 2;
  }

  t.set({ left: lx, top: ty });
  t.setCoords();

  if (typeof clampInsideCanvas === 'function') {
    clampInsideCanvas(t);
  }
  if (typeof firstOverlap === 'function' && typeof placeAtFreeSpot === 'function') {
    const other = firstOverlap(t);
    if (other) {
      placeAtFreeSpot(t);
    }
  }
  const id =
      (rest && (rest.emoId || rest.id)) ||
      (window.crypto?.randomUUID
          ? window.crypto.randomUUID()
          : String(Date.now() + Math.random()));

  t.set('emoId', id);
  t.set('emoKind', 'text');
  objectsById.set(id, t);

  c.setActiveObject(t);
  c.requestRenderAll();

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

  const c = initCanvas();
  if (!c) return;

  // If this object is active, clear selection BEFORE removing it
  if (c.getActiveObject?.() === o) {
    c.discardActiveObject();
  }

  c.remove(o);
  objectsById.delete(id);
  c.requestRenderAll();

  try {
    window.dispatchEvent(new CustomEvent('emo:removed', { detail: { id } }));
  } catch (_) {}
}

export function selectObject(id) {
  const o = objectsById.get(id);
  if (!o) return;

  const c = initCanvas();
  if (!c) return;

  c.setActiveObject(o);
  c.requestRenderAll();
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

        // 🔥 1) initial scale so it fits inside canvas (with margin)
        const cw = c.getWidth();
        const ch = c.getHeight();
        const pad = 16; // margin to canvas edges

        const rawW = svgObj.width  || 1;
        const rawH = svgObj.height || 1;

        const maxW = cw - pad * 2;
        const maxH = ch - pad * 2;
        const s0   = Math.min(maxW / rawW, maxH / rawH, 1);

        svgObj.set({
          scaleX: s0,
          scaleY: s0,
          selectable: true,
          lockScalingFlip: false,
        });
        enforceUniformScalingControls(svgObj);

        // 🔥 2) find nearest-to-center position with no overlap (and shrink if needed)
        autoPlaceImageWithoutOverlap(svgObj, c, pad);

        // 🔥 3) identify & track
        const id = crypto.randomUUID();
        svgObj.set('emoId', id);
        svgObj.set('emoKind', 'image');
        // store cleaned SVG so image step can save/rehydrate
        svgObj._svgSource = svgText;
        svgObj._imageKind = 'upload';

        c.add(svgObj);
        objectsById.set(id, svgObj);
        c.setActiveObject(svgObj);
        svgObj.setCoords();
        c.requestRenderAll();

        resolve(id);
      });
    } catch (err) {
      reject(err || new Error('Failed to parse SVG'));
    }
  });
}
function autoPlaceImageWithoutOverlap(o, c, pad = 8) {
  const cw = c.getWidth();
  const ch = c.getHeight();

  // start from whatever scale the caller set
  let scaleX = o.scaleX || 1;
  let scaleY = o.scaleY || 1;

  const minScale = 0.15;   // don’t shrink below this
  const step     = 24;     // grid step in px
  const maxAttempts = 6;   // how many times to shrink & retry

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // update scale for this attempt (first attempt = original scale)
    if (attempt > 0) {
      scaleX *= 0.85;
      scaleY *= 0.85;
      if (scaleX < minScale || scaleY < minScale) break;
    }

    o.set({ scaleX, scaleY });
    o.setCoords();

    // measure current visual bounds
    const br = o.getBoundingRect(true, true);
    let w = br.width  || 1;
    let h = br.height || 1;

    // if still too big for canvas, try smaller
    if (w > cw - pad * 2 || h > ch - pad * 2) {
      continue;
    }

    // ideal center placement (top-left of bounding box)
    const centerX = (cw - w) / 2;
    const centerY = (ch - h) / 2;

    // build candidate positions on a grid, sorted by distance to center
    const candidates = [];
    for (let y = pad; y + h + pad <= ch; y += step) {
      for (let x = pad; x + w + pad <= cw; x += step) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = dx * dx + dy * dy;
        candidates.push({ x, y, dist });
      }
    }
    candidates.sort((a, b) => a.dist - b.dist);

    // try each candidate until we find one that doesn’t overlap
    for (const pos of candidates) {
      if (rectIsFree(pos.x, pos.y, w, h)) {
        o.set({ left: pos.x, top: pos.y });
        o.setCoords();
        return;
      }
    }
  }

  // fallback: center + clamp (may overlap if absolutely no space)
  const finalW = (o.width  || 1) * (o.scaleX || 1);
  const finalH = (o.height || 1) * (o.scaleY || 1);

  o.set({
    left: Math.max(pad, (cw - finalW) / 2),
    top:  Math.max(pad, (ch - finalH) / 2),
  });
  clampInsideCanvas(o);
  o.setCoords();
}


// svgText: cleaned SVG string
// opts: used BOTH by rehydrate + library
export function addSvgFromMarkup(svgText, opts = {}) {
  const {
    emoId,
    left,
    top,
    angle,
    scaleX,
    scaleY,
    flipX,
    flipY,
    autoPlace = false,
    kind = 'upload',
  } = opts;

  const c = initCanvas();

  return new Promise((resolve, reject) => {
    try {
      // defensive: strip style/doctype again if needed
      let text = svgText
          .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

      if (!/<svg[\s\S]*?>/i.test(text)) {
        reject(new Error('Invalid SVG markup'));
        return;
      }

      fabric.loadSVGFromString(text, (objects, options) => {
        if (!objects || !objects.length) {
          reject(new Error('Empty or unsupported SVG'));
          return;
        }

        const svgObj = fabric.util.groupSVGElements(objects, options);

        const cw = c.getWidth();
        const ch = c.getHeight();
        const pad = 16;

        // --- base scale (fit into canvas if no explicit scale is given)
        const rawW = svgObj.width  || 1;
        const rawH = svgObj.height || 1;

        let sx = scaleX;
        let sy = scaleY;

        if (sx == null || sy == null) {
          const maxW = cw - pad * 2;
          const maxH = ch - pad * 2;
          const s0   = Math.min(maxW / rawW, maxH / rawH, 1);
          sx = sy = s0;
        }

        svgObj.set({
          scaleX: sx,
          scaleY: sy,
          angle:  angle ?? 0,
          flipX: !!flipX,
          flipY: !!flipY,
          selectable: true,
          lockScalingFlip: false,
        });
        enforceUniformScalingControls(svgObj);

        // --- positioning
        if (left != null && top != null) {
          // rehydrate path: use stored position
          svgObj.set({ left, top });
          svgObj.setCoords();
        } else if (autoPlace) {
          // 🔥 library / “spawn new” path:
          autoPlaceImageWithoutOverlap(svgObj, c, pad);
        } else {
          // simple center fallback
          const wScaled = (rawW * sx);
          const hScaled = (rawH * sy);
          svgObj.set({
            left: (cw - wScaled) / 2,
            top:  (ch - hScaled) / 2,
          });
          svgObj.setCoords();
        }

        // id + meta
        const id = emoId || (crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now() + Math.random()));

        svgObj.set('emoId', id);
        svgObj.set('emoKind', 'image');
        svgObj._svgSource = text;
        svgObj._imageKind = kind;

        c.add(svgObj);
        objectsById.set(id, svgObj);
        c.setActiveObject(svgObj);
        svgObj.setCoords();
        c.requestRenderAll();

        resolve(id);
      });
    } catch (err) {
      reject(err || new Error('Failed to add SVG from markup'));
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

// first overlapping other object (excluding 'o'), else null
function firstOverlap(o) {
  const a = o.getBoundingRect(true, true);
  const objs = canvas.getObjects().filter(p =>
      p !== o &&
      p.visible &&
      !p._isLayout
  );
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
  const c = initCanvas();
  if (!c) return;

  const objs = c.getObjects();
  const alreadyOnCanvas = objs.includes(o);

  // measure current size
  if (!alreadyOnCanvas) {
    c.add(o);
  }
  o.setCoords();
  const br = o.getBoundingRect(true, true);
  if (!alreadyOnCanvas) {
    c.remove(o);
  }

  const pad  = 8;                // inner margin
  const cw   = c.getWidth();
  const ch   = c.getHeight();
  const step = 24;               // grid step for scanning

  const w = br.width  || 1;
  const h = br.height || 1;

  // “ideal” center top-left for this box
  const centerX = (cw - w) / 2;
  const centerY = (ch - h) / 2;

  // build all candidate positions on a grid, then sort by distance to center
  const candidates = [];
  for (let y = pad; y + h + pad <= ch; y += step) {
    for (let x = pad; x + w + pad <= cw; x += step) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist2 = dx * dx + dy * dy;
      candidates.push({ x, y, dist2 });
    }
  }
  candidates.sort((a, b) => a.dist2 - b.dist2);

  // pick the closest free spot to center
  for (const pos of candidates) {
    if (rectIsFree(pos.x, pos.y, w, h)) {
      o.left = pos.x;
      o.top  = pos.y;
      o.setCoords();
      return;
    }
  }

  // fallback: exact geometric center, clamped
  o.left = Math.max(pad, Math.min(cw - w - pad, centerX));
  o.top  = Math.max(pad, Math.min(ch - h - pad, centerY));
  o.setCoords();
}



// check if a rectangle would overlap any existing object
function rectIsFree(left, top, width, height) {
  const c = canvas || initCanvas();
  if (!c) return true;

  const a = { left, top, width, height };

  return !c.getObjects().some((bObj) => {
    if (!bObj.visible || bObj._isLayout) return false;  // 👈 skip bg/layout
    const b = bObj.getBoundingRect(true, true);
    return rectsOverlap(a, b);
  });
}


// add this export
function applyFontSize(o, size /* number */) {
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
}

// public API used by the text panel
export function setFontSize(id, size /* number */) {
  const o = objectsById.get(id);
  if (!o) return;

  applyFontSize(o, size);
  canvas.requestRenderAll();
}

function enforceUniformScalingControls(o) {
  if (!o || !o.setControlsVisibility) return;

  o.setControlsVisibility({
    mt: false,
    mb: false,
    ml: false,
    mr: false,
    // corners + rotate stay visible
  });

  if (o.controls && o.controls.mtr) {
    o.controls.mtr.y = 0.5;
    o.controls.mtr.offsetY = 40;
  }
}
// --- SAFETY PATCH: avoid crashes when an object has no canvas but Fabric tries to draw controls
if (window.fabric && fabric.Object && !fabric.Object.__emoPatchedDrawControls) {
  const originalDrawControls = fabric.Object.prototype.drawControls;

  fabric.Object.prototype.drawControls = function (ctx, options) {
    // If this object is no longer attached to a canvas, just skip drawing controls
    if (!this.canvas || typeof this.canvas.getRetinaScaling !== 'function') {
      return;
    }

    return originalDrawControls.call(this, ctx, options);
  };

  fabric.Object.__emoPatchedDrawControls = true;
}

