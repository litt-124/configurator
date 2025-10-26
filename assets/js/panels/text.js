// ./panels/text.js
import {
  initCanvas, getCanvas,
  addTextObject, updateTextObject, removeObject, selectObject, setTextAlign, setFontSize
} from '../canvas.js';

import {
  ensureFontLoaded,
  setFontFamilyForActive
  // NOTE: no need for setDefaultFontFamily for per-card behavior
} from '../canvas.js';

const FONTS = {
  aero:  { family: 'Aero',  url: '/assets/fonts/Aero.woff2', label: 'Aero' },
  arial: { family: 'Arial', url: null,                        label: 'Sans' },
};

export default function onTextTab(pane) {
  if (pane.dataset.inited === '1') return;
  pane.dataset.inited = '1';

  // ensure there is a canvas
  initCanvas();

  // ── 0) PRELOAD AERO ONCE (no global default switching) ────────────────
  ensureFontLoaded(FONTS.aero.family, FONTS.aero.url).catch(() => { /* ignore */ });

  // 🔄 sync FROM canvas selection -> focus matching card input in THIS pane
  const c = getCanvas();
  const syncFromCanvas = () => {
    const active = c.getActiveObject();
    if (!active || !active.emoId) return;

    const card = pane.querySelector(`.js-text-card[data-canvas-id="${active.emoId}"]`);
    if (!card) return;

    // focus the correct input
    const input = card.classList.contains('is-editing')
      ? card.querySelector('.text-card__advanced input.form-control')
      : card.querySelector('.text-card__simple  input.form-control');
    input?.focus();

    // reflect size
    const sizeInput = card.querySelector('.size-stepper input');
    if (sizeInput && typeof active.fontSize === 'number') {
      sizeInput.value = String(Math.round(active.fontSize));
    }

    // reflect font in THIS CARD’s label
    const pickerLabel = card.querySelector('.font-picker .current-font');
    if (pickerLabel) {
      const fam = (active.fontFamily || '').toLowerCase();
      const key = fam.includes('aero') ? 'aero' : (fam.includes('arial') ? 'arial' : null);
      pickerLabel.textContent = (key && FONTS[key]) ? FONTS[key].label : (active.fontFamily || '');
    }
  };
  c.on('selection:created', syncFromCanvas);
  c.on('selection:updated',  syncFromCanvas);

  // hooks inside this pane only
  const addBtn = pane.querySelector('.js-add-text');
  const list   = pane.querySelector('.js-text-list');
  const tplEl  = pane.querySelector('#text-card-tpl');
  if (!addBtn || !list || !tplEl) return;

  let counter = 0;
window.addEventListener('emo:removed', (e) => {
  const id = e.detail?.id;
  if (!id) return;
  const card = pane.querySelector(`.js-text-card[data-canvas-id="${id}"]`);
  card?.remove();
});

// duplicate (toolbar created a new canvas object; add matching card)
window.addEventListener('emo:added', (e) => {
  const id = e.detail?.id;
  if (!id) return;
  const c = getCanvas();
  const obj = c?.getObjects().find(o => o.emoId === id);
  if (!obj) return;

  const newCard = createCardForExistingObject(obj, tplEl);
  list.appendChild(newCard);
  newCard.querySelector('input.form-control')?.focus();
});

// save (toolbar wants to exit edit mode on the matching card)
window.addEventListener('emo:save', (e) => {
  const id = e.detail?.id;
  if (!id) return;
  const card = pane.querySelector(`.js-text-card[data-canvas-id="${id}"]`);
  if (!card) return;

  card.classList.remove('is-editing');
  card.querySelectorAll('input.form-control').forEach(inp => inp.blur());
   const c = getCanvas();
 if (c?.getActiveObject?.()) {
   c.discardActiveObject();
   c.requestRenderAll();
 }
});
  const initCardFontPicker = (card, canvasId) => {
    const picker = card.querySelector('.font-picker');
    if (!picker) return;

    // init label → Aero
    const labelEl = picker.querySelector('.current-font');
    if (labelEl) labelEl.textContent = FONTS.aero.label;

    // click handler (per card)
    picker.addEventListener('click', async (e) => {
      const btn = e.target.closest('.dropdown-item');
      if (!btn) return;

      const key  = btn.dataset.font; // 'aero' | 'arial'
      const meta = FONTS[key];
      if (!meta) return;

      // make sure font is ready
      await ensureFontLoaded(meta.family, meta.url);

      // apply to THIS card’s object
      selectObject(canvasId);
      setFontFamilyForActive(meta.family);

      // update this card's label
      if (labelEl) labelEl.textContent = btn.dataset.label || meta.label || meta.family;
    });
  };
function createCardForExistingObject(obj, tplEl) {
  const list = tplEl.closest('.js-text-pane')?.querySelector('.js-text-list') 
             || document.querySelector('.js-text-list'); // or pass `list` in as param if you prefer
  const nextIndex = (list?.querySelectorAll('.js-text-card').length || 0) + 1;
  const html = tplEl.textContent.trim().replaceAll('__N__', String(nextIndex));
      const wrap = document.createElement('div');

  wrap.innerHTML = html;
  const card = wrap.firstElementChild;

  card.dataset.canvasId = obj.emoId;

  const simpleInput = card.querySelector('.text-card__simple input.form-control');
  const advInput    = card.querySelector('.text-card__advanced input.form-control');
  const sizeInput   = card.querySelector('.size-stepper input');

  if (simpleInput) simpleInput.value = obj.text || '';
  if (advInput)    advInput.value    = obj.text || '';
  if (sizeInput && typeof obj.fontSize === 'number') {
    sizeInput.value = String(Math.round(obj.fontSize));
  }

  // font label for this card
  const pickerLabel = card.querySelector('.font-picker .current-font');
  if (pickerLabel) {
    const fam = (obj.fontFamily || '').toLowerCase();
    pickerLabel.textContent =
      fam.includes('aero') ? FONTS.aero.label :
      fam.includes('arial') ? FONTS.arial.label :
      (obj.fontFamily || '');
  }

  // inputs like in makeCard()
  if (simpleInput) {
    simpleInput.addEventListener('input', (e) => {
      updateTextObject(obj.emoId, e.target.value);
      if (advInput && document.activeElement !== advInput) advInput.value = e.target.value;
    });
    simpleInput.addEventListener('focus', () => selectObject(obj.emoId));
  }
  if (advInput) {
    advInput.addEventListener('input', (e) => {
      updateTextObject(obj.emoId, e.target.value);
      if (simpleInput && document.activeElement !== simpleInput) simpleInput.value = e.target.value;
    });
    advInput.addEventListener('focus', () => selectObject(obj.emoId));
  }

  // per-card font picker
  initCardFontPicker(card, obj.emoId);

  return card;
}

  const makeCard = () => {
    const nextIndex = list.querySelectorAll('.js-text-card').length + 1; // 1-based
    const html = tplEl.textContent.trim().replaceAll('__N__', String(nextIndex));
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const card = wrap.firstElementChild;
    const defaultSize = 10;

    // create a canvas text object and link it to the card
    const canvasId = addTextObject({ text: '', fontSize: defaultSize });
    card.dataset.canvasId = canvasId;

    // force initial font to Aero on the freshly created object (per-card)
    // (selection ensures setFontFamilyForActive applies to the right one)
    selectObject(canvasId);
    setFontFamilyForActive(FONTS.aero.family);

    // init this card's font picker
    initCardFontPicker(card, canvasId);

    const simpleInput = card.querySelector('.text-card__simple input.form-control');
    const advInput    = card.querySelector('.text-card__advanced input.form-control');

    if (simpleInput) {
      simpleInput.addEventListener('input', (e) => {
        updateTextObject(canvasId, e.target.value);
        if (advInput && document.activeElement !== advInput) advInput.value = e.target.value;
      });
      simpleInput.addEventListener('focus', () => selectObject(canvasId));
    }

    if (advInput) {
      advInput.addEventListener('input', (e) => {
        updateTextObject(canvasId, e.target.value);
        if (simpleInput && document.activeElement !== simpleInput) simpleInput.value = e.target.value;
      });
      advInput.addEventListener('focus', () => selectObject(canvasId));
    }

    return card;
  };

  addBtn.addEventListener('click', () => {
    const card = makeCard();
    list.appendChild(card);
    card.querySelector('input.form-control')?.focus();
  }, { once: false });

  list.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.js-edit-text');
    const backBtn = e.target.closest('.js-exit-edit');
    const delBtn  = e.target.closest('.js-delete-text');
    const sizeBtn = e.target.closest('.size-stepper .btn');

    const alignBtn = e.target.closest('.align-group .btn');
    if (alignBtn) {
      const card = alignBtn.closest('.js-text-card');
      const id = card?.dataset.canvasId;
      if (!id) return;

      const align =
        alignBtn.dataset.align ||
        (alignBtn.getAttribute('data-align') || '').toLowerCase();

      if (align === 'left' || align === 'center' || align === 'right') {
        setTextAlign(id, align);

        const group = alignBtn.closest('.align-group');
        group?.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
        alignBtn.classList.add('active');
      }
      return;
    }

    if (editBtn) {
      const card = editBtn.closest('.js-text-card');
      card?.classList.add('is-editing');
      const id = card?.dataset.canvasId;
      const simpleVal = card?.querySelector('.text-card__simple input.form-control')?.value || '';
      const advInput  = card?.querySelector('.text-card__advanced input.form-control');
      if (advInput) advInput.value = simpleVal;
      if (id) selectObject(id);
      return;
    }
    if (backBtn) {
      const card = backBtn.closest('.js-text-card');
      card?.classList.remove('is-editing');
      const id = card?.dataset.canvasId;
      if (id) selectObject(id);
      return;
    }
    if (delBtn) {
      const card = delBtn.closest('.js-text-card');
      const id = card?.dataset.canvasId;
      if (id) removeObject(id);
      card?.remove();
    }
    if (sizeBtn) {
      const card = sizeBtn.closest('.js-text-card');
      const id = card?.dataset.canvasId;
      if (!id) return;

      const input = card.querySelector('.size-stepper input');
      let val = parseInt(input?.value, 10);
      if (Number.isNaN(val)) val = 10;

      let step = Number(sizeBtn.dataset.step);
      if (!step) {
        const href = sizeBtn.querySelector('use')?.getAttribute('href') || '';
        step = href.includes('plus') ? 1 : -1;
      }

      val = Math.min(200, Math.max(6, val + step));
      if (input) input.value = String(val);

      setFontSize(id, val);
    }
  });

  // 2b) typing directly in the size input
  list.addEventListener('input', (e) => {
    const input = e.target.closest('.size-stepper input');
    if (!input) return;

    const card = input.closest('.js-text-card');
    const id = card?.dataset.canvasId;
    if (!id) return;

    let val = parseInt(input.value, 10);
    if (Number.isNaN(val)) val = 10;
    val = Math.min(200, Math.max(6, val));
    input.value = String(val);

    setFontSize(id, val);
  });
}
