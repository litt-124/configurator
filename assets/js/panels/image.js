import { getCanvas, selectObject, addSvgFromFile } from '../canvas.js';

export default function onImageTab(pane) {
  if (!pane || pane.dataset.inited === '1') return;
  pane.dataset.inited = '1';

  const ctas    = pane.querySelector('.js-image-ctas');
  const archive = pane.querySelector('.js-image-archive');
  const browse  = pane.querySelector('.js-browse-btn');

  if (!ctas || !archive || !browse) return;

  browse.addEventListener('click', () => {
    ctas.classList.add('d-none');
    archive.classList.remove('d-none');
  });

  const uploadInput  = pane.querySelector('#svgUploadInput');
  const uploadedGrid = pane.querySelector('#imageLibrary .js-uploaded');
  const tplEl        = document.getElementById('image-card-tpl');
  if (!uploadInput || !uploadedGrid || !tplEl) return;

  // 🔗 keep mapping between canvas object id (emoId) and the card element
  const cardById = new Map();
  let counter = 0;

  // expose for toolbar module to use
  pane.__imageCardById = cardById;
  pane.__uploadedGrid  = uploadedGrid;
  pane.__imageCardTpl  = tplEl;

  // upload + add to canvas immediately (addSvgFromFile already centers/scales)
  uploadInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const c = getCanvas();
    const prev = c.renderOnAddRemove;
    c.renderOnAddRemove = false;

    for (const file of files) {
      const ok = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
      if (!ok) continue;

      counter += 1;

      // 1) add to canvas (returns emoId)
      const canvasId = await addSvgFromFile(file);

      // 2) create a card bound to emoId (NO panel remove button anymore)
      createOrUpdateImageCard({
        pane,
        emoId: canvasId,
        displayName: `${counter}. ${file.name}`,
        // thumbnail: reuse blob for a cheap preview; toolbar duplicates will use generated preview
        blobFile: file,
      });
    }

    c.renderOnAddRemove = prev;
    c.requestRenderAll();
    e.target.value = '';
  });

  // panel actions: ONLY select from panel now (no remove button anymore)
  pane.addEventListener('click', (e) => {
    const selectBtn = e.target.closest('.js-select');
    if (selectBtn) {
      const card = selectBtn.closest('.img-card');
      const id = card?.dataset.canvasId;
      if (id) {
        selectObject(id);
        getCanvas()?.requestRenderAll();
      }
    }
  });
// remove card when canvas object is removed (any source)
window.addEventListener('emo:removed', (e) => {
  const id = e.detail?.id;
  if (!id) return;
  const card = pane.__imageCardById.get(id);
  if (card) {
    card.remove();
    pane.__imageCardById.delete(id);
  }
});

// when toolbar duplicates an image and dispatches emo:added,
// create a matching card (only if it’s actually an image)
window.addEventListener('emo:added', (e) => {
  const id = e.detail?.id;
  if (!id) return;
  const c = getCanvas();
  const obj = c?.getObjects().find(o => o.emoId === id);
  if (!obj || obj.emoKind !== 'image') return;

  // base label from currently active/nearest card (fallback to generic)
  const base = 'Image';
  createOrUpdateImageCard({
    pane,
    emoId: id,
    displayName: `${base} (copy)`,
    fromObject: obj
  });
});

// optional: if you want Save to visually “de-select” card etc.
window.addEventListener('emo:save', (e) => {
  // currently no special UI change for images
});

}
async function makeObjectPreviewDataUrl(obj, maxSize = 120) {
  return new Promise((resolve) => {
    obj.clone((cloned) => {
      const w = (cloned.width  || 1) * cloned.scaleX;
      const h = (cloned.height || 1) * cloned.scaleY;
      const s = Math.min(maxSize / w, maxSize / h, 1);

      const cw = Math.ceil(w * s);
      const ch = Math.ceil(h * s);

      const off = new fabric.StaticCanvas(null, { width: cw, height: ch });
      cloned.set({ left: 0, top: 0, scaleX: (cloned.scaleX||1)*s, scaleY: (cloned.scaleY||1)*s });
      off.add(cloned); off.renderAll();
      const url = off.toDataURL({ format: 'png' });
      off.dispose?.();
      resolve(url);
    }, ['*']);
  });
}

async function createOrUpdateImageCard({ pane, emoId, displayName, blobFile, fromObject }) {
  const uploadedGrid = pane.__uploadedGrid;
  const tplEl = pane.__imageCardTpl;
  const cardById = pane.__imageCardById;

  let card = cardById.get(emoId);
  if (!card) {
    const frag = tplEl.content.cloneNode(true);
    card = frag.firstElementChild;
    uploadedGrid.appendChild(card);
  }

  card.dataset.canvasId = emoId;

  // label
  const nameEl = card.querySelector('.img-name');
  if (nameEl && displayName) nameEl.textContent = displayName;

  // only “Select” in panel; hide “Remove”
  card.querySelector('.js-insert')?.classList.add('d-none');
  card.querySelector('.js-select')?.classList.remove('d-none');
  card.querySelector('.js-remove')?.classList.add('d-none');

  // thumbnail
  const thumb = card.querySelector('.img-thumb');
  if (thumb) {
    thumb.innerHTML = '';
    if (blobFile) {
      const url = URL.createObjectURL(blobFile);
      const img = document.createElement('img');
      img.src = url; img.alt = displayName || 'image';
      img.onload = () => URL.revokeObjectURL(url);
      thumb.appendChild(img);
    } else if (fromObject) {
      const url = await makeObjectPreviewDataUrl(fromObject);
      const img = document.createElement('img');
      img.src = url; img.alt = displayName || 'image';
      thumb.appendChild(img);
    }
  }

  cardById.set(emoId, card);
  return card;
}

