import { getCanvas, selectObject, addSvgFromMarkup } from '../canvas.js';
import { writeStepData, readStepData, STEP_IDS } from '../utils.js';

export default function onImageTab(pane) {
  if (!pane || pane.dataset.inited === '1') return;
  pane.dataset.inited = '1';

  const ctas    = pane.querySelector('.js-image-ctas');
  const archive = pane.querySelector('.js-image-archive');
  const browse  = pane.querySelector('.js-browse-btn');

  if (!ctas || !archive || !browse) return;

  // --- browse/archive toggle (still basic) ---
  browse.addEventListener('click', () => {
    ctas.classList.add('d-none');
    archive.classList.remove('d-none');
  });

  const uploadInput  = pane.querySelector('#svgUploadInput');
  const uploadedGrid = pane.querySelector('#imageLibrary .js-uploaded');
  const tplEl        = document.getElementById('image-card-tpl');
  const saveBtn      = pane.querySelector('.js-save-button');

  if (!uploadInput || !uploadedGrid || !tplEl || !saveBtn) return;

  const cardById = new Map();
  let currentSelectedId = null;
  // persistent model for this pane
  let imagesModel = [];

  // expose if you still want it elsewhere
  pane.__imagesModel = imagesModel;

  // expose for toolbar / other modules (optional)
  pane.__imageCardById = cardById;
  pane.__uploadedGrid  = uploadedGrid;
  pane.__imageCardTpl  = tplEl;
  function syncImageStepFromCanvas() {
    const c = getCanvas();
    if (!c) return;

    // map id -> stored model item (from upload / initial load)
    const modelMap = new Map((pane.__imagesModel || imagesModel || []).map(m => [m.id, m]));

    const items = c.getObjects()
        .filter(o => o.emoKind === 'image' && o.emoId)
        .map(o => {
          const base = modelMap.get(o.emoId) || {};

          return {
            id:     o.emoId,
            kind:   o._imageKind || base.kind || 'upload',
            // 🔥 prefer object fields, then model fallback
            svg:    o._svgSource ?? base.svg ?? null,
            src:    o._imageSrc   ?? base.src ?? null,
            left:   o.left,
            top:    o.top,
            angle:  o.angle || 0,
            scaleX: o.scaleX || 1,
            scaleY: o.scaleY || 1,
            flipX:  !!o.flipX,
            flipY:  !!o.flipY,
          };
        })
        // keep only entries that actually have some source
        .filter(it => it.svg || it.src);

    writeStepData(STEP_IDS.IMAGE, {
      activeId: currentSelectedId || null,
      items,
    });
  }

  // helper to visually mark the active card
  function markActiveCard(id) {
    currentSelectedId = id || null;

    for (const card of cardById.values()) {
      if (!card) continue;
      if (card.dataset.canvasId === id) {
        card.classList.add('is-active');
      } else {
        card.classList.remove('is-active');
      }
    }
  }
  async function addImageFromSvgText(svgText, displayName, kind = 'upload') {
    const c = getCanvas();

    // let canvas handle SVG (auto scale, no-overlap, etc.)
    const emoId = await addSvgFromMarkup(svgText, {
      autoPlace: true,
      kind: 'library',
    });

    // find the created object
    const obj = c.getObjects().find(o => o.emoId === emoId);
    if (obj) {
      obj._svgSource = svgText;
      obj._imageKind = kind;
    }

    // store in model (for rehydrate)
    imagesModel.push({
      id:    emoId,
      kind,
      svg:   svgText,
      left:  null,
      top:   null,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
    });
    pane.__imagesModel = imagesModel;

    // create / update a card for it
    await createOrUpdateImageCard({
      pane,
      emoId,
      displayName,
      fromObject: obj,
    });

    // select it in canvas + mark active card
    selectObject(emoId);
    getCanvas()?.requestRenderAll();
    // you already have markActiveCard defined
    markActiveCard(emoId);

    return emoId;
  }

  const savedImageStep = readStepData(STEP_IDS.IMAGE);
  if (savedImageStep && Array.isArray(savedImageStep.items)) {
    imagesModel = savedImageStep.items.map(it => ({ ...it }));
    pane.__imagesModel = imagesModel;
  }
  uploadInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const c = getCanvas();
    const prev = c.renderOnAddRemove;
    c.renderOnAddRemove = false;


    for (const file of files) {
      const ok = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
      if (!ok) continue;

      const svgText = await file.text();

      await addImageFromSvgText(svgText, file.name, 'upload');
    }


    c.renderOnAddRemove = prev;
    c.requestRenderAll();
    e.target.value = '';

    // store this imagesModel somewhere the Save handler can access (e.g. pane.__imagesModel)
    pane.__imagesModel = imagesModel;
  });

  // 🔥 2) PANEL CLICK: select card → select object on canvas
  pane.addEventListener('click', (e) => {
    const selectBtn = e.target.closest('.js-select');
    if (selectBtn) {
      const card = selectBtn.closest('.img-card');
      const id = card?.dataset.canvasId;
      if (id) {
        selectObject(id);
        getCanvas()?.requestRenderAll();
        markActiveCard(id);
      }
    }
  });
  // Click on library thumbnail → behave like upload
  pane.addEventListener('click', async (e) => {
    const libBtn = e.target.closest('.js-lib-image');
    if (!libBtn) return;

    const svgUrl  = libBtn.dataset.svgUrl;
    const name    = libBtn.dataset.name || 'Library image';

    if (!svgUrl) return;

    try {
      const resp = await fetch(svgUrl);
      if (!resp.ok) throw new Error('Failed to load SVG');
      const svgText = await resp.text();

      await addImageFromSvgText(svgText, name, 'library');
    } catch (err) {
      console.error('Library SVG load failed:', err);
      // optional: showAlert('danger', 'Could not load image');
    }
  });

  // 🔥 3) SYNC: when canvas object is removed, remove card too
  window.addEventListener('emo:removed', (e) => {
    const id = e.detail?.id;
    if (!id) return;
    const card = pane.__imageCardById.get(id);
    if (card) {
      card.remove();
      pane.__imageCardById.delete(id);
      if (currentSelectedId === id) {
        currentSelectedId = null;
      }
    }

  });

  // 🔥 4) SYNC: when toolbar duplicates an image, add a new card
  window.addEventListener('emo:added', async (e) => {
    const id = e.detail?.id;
    if (!id) return;

    const c = getCanvas();
    const obj = c?.getObjects().find(o => o.emoId === id);
    if (!obj || obj.emoKind !== 'image') return;

    await createOrUpdateImageCard({
      pane,
      emoId: id,
      displayName: 'Image (copy)',
      fromObject: obj,
    });

  });


  // optional: nothing special for images yet, but here if needed
  window.addEventListener('emo:save', () => {
    // no-op for now
  });

  // 🔥 5) INITIAL FILL: if canvas already has images (e.g. after rehydrate)
  (function initExistingImages() {
    const c = getCanvas();
    const objs = c.getObjects() || [];
    let idx = 0;
    objs.forEach((o) => {
      if (o.emoKind === 'image' && o.emoId) {
        idx += 1;
        createOrUpdateImageCard({
          pane,
          emoId: o.emoId,
          displayName: `Image ${idx}`,
          fromObject: o,
        });
      }
    });

    // Optional: restore previous active image if you saved it:
    const saved = readStepData(STEP_IDS.IMAGE);
    if (saved?.activeId && cardById.has(saved.activeId)) {
      markActiveCard(saved.activeId);
      selectObject(saved.activeId);
      getCanvas()?.requestRenderAll();
    }
  })();

  saveBtn.addEventListener('click', () => {
    syncImageStepFromCanvas();
  });



}

/* ---------- helpers ---------- */

async function makeObjectPreviewDataUrl(obj, maxSize = 120) {
  return new Promise((resolve) => {
    obj.clone((cloned) => {
      // 1) preview: no rotation or mirroring, and ignore original scale
      cloned.set({
        angle: 0,
        flipX: false,
        flipY: false,
      });

      cloned.set({ scaleX: 1, scaleY: 1 });
      cloned.setCoords();

      // 2) use *unscaled* width/height as our reference
      const baseW = cloned.width  || 1;
      const baseH = cloned.height || 1;

      const pad = 6;
      const s = Math.min(
          (maxSize - pad * 2) / baseW,
          (maxSize - pad * 2) / baseH,
          1
      );

      const cw = Math.ceil(baseW * s) + pad * 2;
      const ch = Math.ceil(baseH * s) + pad * 2;

      const off = new fabric.StaticCanvas(null, { width: cw, height: ch });

      // 3) apply uniform preview scale (same for all) & center with padding
      cloned.set({
        left:   pad,
        top:    pad,
        scaleX: s,
        scaleY: s,
      });

      off.add(cloned);
      off.renderAll();

      const url = off.toDataURL({ format: 'png' });
      off.dispose?.();
      resolve(url);
    }, ['*']);
  });
}

async function createOrUpdateImageCard({ pane, emoId, displayName, blobFile, fromObject }) {
  const uploadedGrid = pane.__uploadedGrid;
  const tplEl        = pane.__imageCardTpl;
  const cardById     = pane.__imageCardById;

  let card = cardById.get(emoId);
  if (!card) {
    const frag = tplEl.content.cloneNode(true);
    card = frag.firstElementChild;
    uploadedGrid.appendChild(card);
  }

  card.dataset.canvasId = emoId;

  // label
  const nameEl = card.querySelector('.img-name');
  if (nameEl && displayName) {
    nameEl.textContent = displayName;
  }

  // we only use "Select" in this panel now
  card.querySelector('.js-select')?.classList.remove('d-none');

  // thumbnail
  const thumb = card.querySelector('.img-thumb');
  if (thumb) {
    thumb.innerHTML = '';

    // Always generate preview from the canvas object
    if (fromObject) {
      const url = await makeObjectPreviewDataUrl(fromObject);
      const img = document.createElement('img');
      img.src = url;
      img.alt = displayName || 'image';
      thumb.appendChild(img);
    } else if (blobFile) {
      // fallback only if clone is not ready yet
      const url = URL.createObjectURL(blobFile);
      const img = document.createElement('img');
      img.src = url;
      img.alt = displayName || 'image';
      img.onload = () => URL.revokeObjectURL(url);
      thumb.appendChild(img);
    }
  }


  cardById.set(emoId, card);
  return card;
}
