import {
  initCanvas,
  getCanvas,
  addTextObject,
  updateTextObject,
  removeObject,
  selectObject,
  setFontSize,
  setFontFamilyForActive,
} from '../canvas.js';

import {
  writeStepData,
  showAlert,
} from '../utils.js';

const PANE_ID      = 'pane-text';
const NEXT_PANE_ID = 'pane-image';

export const FONTS = {
  aero:  { family: 'Aero',  url: '/assets/fonts/Aero.woff2', label: 'Aero' },
  arial: { family: 'Arial', url: null,                        label: 'Arial' },
};

const SELECTORS = {
  addButton:        '.js-add-text',
  list:             '.js-text-list',
  template:         '#text-card-tpl',
  saveButton:       '.js-save-button',

  card:             '.js-text-card',
  cardIndex:        '.js-text-card-index',

  simpleSection:    '.js-text-simple',
  simpleInput:      '.js-text-simple-input',
  advancedSection:  '.js-text-advanced',
  advancedInput:    '.js-text-advanced-input',

  advancedToolbar:  '.js-text-advanced-toolbar',

  fontPicker:       '.js-text-font-picker',
  fontLabel:        '.js-text-font-label',

  sizeStepper:      '.js-text-size-stepper',
  sizeInput:        '.js-text-size-input',
  sizeBtn:          '.js-text-size-btn',

  editBtn:          '.js-text-edit',
  exitEditBtn:      '.js-text-exit-edit',
  deleteBtn:        '.js-text-delete',
};

function getFontKey(fontFamily) {
  const ff = (fontFamily || '').toLowerCase();
  if (ff.includes('arial')) return 'arial';
  return 'aero';
}

/* ---------------------- template & helpers ---------------------- */

function cloneCardTemplate(tplEl) {
  const html = tplEl.textContent.trim();
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  return wrap.firstElementChild;
}

function renumberCards(list) {
  const cards = list.querySelectorAll(SELECTORS.card);
  cards.forEach((card, idx) => {
    const idxEl = card.querySelector(SELECTORS.cardIndex);
    if (idxEl) {
      idxEl.textContent = String(idx + 1);
    }
  });
}

function initCardFontPicker(card, canvasId) {
  const picker  = card.querySelector(SELECTORS.fontPicker);
  const labelEl = card.querySelector(SELECTORS.fontLabel);
  if (!picker || !labelEl) return;

  picker.addEventListener('click', (e) => {
    const btn = e.target.closest('.dropdown-item');
    if (!btn) return;

    const key  = btn.dataset.font; // 'aero' or 'arial'
    const meta = FONTS[key];
    if (!meta) return;

    // Apply font to active object on this canvas
    selectObject(canvasId);
    setFontFamilyForActive(meta.family);

    // Update label
    labelEl.textContent = meta.label;
  });
}

function wireCard(card, canvasId, initialText, initialFontSize, initialFontFamily) {
  card.dataset.canvasId = canvasId;

  const simpleInput = card.querySelector(SELECTORS.simpleInput);
  const advInput    = card.querySelector(SELECTORS.advancedInput);
  const sizeInput   = card.querySelector(SELECTORS.sizeInput);
  const fontLabel   = card.querySelector(SELECTORS.fontLabel);

  // Initial values
  if (simpleInput) simpleInput.value = initialText || '';
  if (advInput)    advInput.value    = initialText || '';

  if (sizeInput && typeof initialFontSize === 'number') {
    sizeInput.value = String(Math.round(initialFontSize));
  }

  if (fontLabel) {
    const meta = FONTS[getFontKey(initialFontFamily)];
    fontLabel.textContent = meta?.label || 'Aero';
  }

  // Simple input bindings
  if (simpleInput) {
    simpleInput.addEventListener('input', (e) => {
      updateTextObject(canvasId, e.target.value);
      if (advInput && document.activeElement !== advInput) {
        advInput.value = e.target.value;
      }
    });
    simpleInput.addEventListener('focus', () => selectObject(canvasId));
  }

  // Advanced input bindings
  if (advInput) {
    advInput.addEventListener('input', (e) => {
      updateTextObject(canvasId, e.target.value);
      if (simpleInput && document.activeElement !== simpleInput) {
        simpleInput.value = e.target.value;
      }
    });
    advInput.addEventListener('focus', () => selectObject(canvasId));
  }

  // Per-card font picker
  initCardFontPicker(card, canvasId);
}

function createCardForObject(obj, tplEl, list) {
  const card = cloneCardTemplate(tplEl);
  if (!card) return null;

  wireCard(
      card,
      obj.emoId,
      obj.text || '',
      typeof obj.fontSize === 'number' ? obj.fontSize : 10,
      obj.fontFamily || '',
  );

  list.appendChild(card);
  renumberCards(list);
  return card;
}

/* ---------------------- main entry ---------------------- */

export default function onTextTab(pane) {
  if (pane.dataset.inited === '1') return;
  pane.dataset.inited = '1';

  // ensure canvas exists
  initCanvas();
  const canvas = getCanvas();

  const addBtn  = pane.querySelector(SELECTORS.addButton);
  const list    = pane.querySelector(SELECTORS.list);
  const tplEl   = pane.querySelector(SELECTORS.template);
  const saveBtn = pane.querySelector(SELECTORS.saveButton);

  if (!addBtn || !list || !tplEl) return;

  /* ---------- sync UI from canvas selection ---------- */

  const syncFromCanvas = () => {
    const active = canvas.getActiveObject();
    if (!active || !active.emoId) return;

    const card = pane.querySelector(
        `${SELECTORS.card}[data-canvas-id="${active.emoId}"]`,
    );
    if (!card) return;

    const isEditing = card.classList.contains('is-editing');
    const targetInput = isEditing
        ? card.querySelector(SELECTORS.advancedInput)
        : card.querySelector(SELECTORS.simpleInput);

    targetInput?.focus();

    const sizeInput = card.querySelector(SELECTORS.sizeInput);
    if (sizeInput && typeof active.fontSize === 'number') {
      sizeInput.value = String(Math.round(active.fontSize));
    }

    const pickerLabel = card.querySelector(SELECTORS.fontLabel);
    if (pickerLabel) {
      const meta = FONTS[getFontKey(active.fontFamily)];
      pickerLabel.textContent = meta?.label || 'Aero';
    }
  };

  canvas.on('selection:created', syncFromCanvas);
  canvas.on('selection:updated',  syncFromCanvas);
  canvas.on('object:modified',    syncFromCanvas);

  /* ---------- Save step button ---------- */

  if (saveBtn) {
    saveBtn.type = 'button';
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();

      const c = getCanvas();
      const texts = c.getObjects().filter(
          (o) => o.emoKind === 'text' && o.emoId,
      );

      const items = texts.map((o) => ({
        id:         o.emoId,
        text:       o.text || '',
        fontSize:   typeof o.fontSize === 'number' ? o.fontSize : 10,
        fontFamily: o.fontFamily || '',
        left:       o.left,
        top:        o.top,
        angle:      typeof o.angle === 'number' ? o.angle : 0,
        align:      o.textAlign || 'left',
        flipX:      !!o.flipX,
        flipY:      !!o.flipY,
      }));

      const data = { items };

      writeStepData(PANE_ID, data);
      showAlert('success');

      const ev = new CustomEvent('configurator:step-complete', {
        detail: { stepId: PANE_ID, nextStepId: NEXT_PANE_ID, data },
      });
      document.dispatchEvent(ev);
    });
  }

  /* ---------- Global emo events ---------- */

  window.addEventListener('emo:removed', (e) => {
    const id = e.detail?.id;
    if (!id) return;
    const card = pane.querySelector(
        `${SELECTORS.card}[data-canvas-id="${id}"]`,
    );
    if (card) {
      card.remove();
      renumberCards(list);
    }
  });

  window.addEventListener('emo:added', (e) => {
    const id = e.detail?.id;
    if (!id) return;

    const c = getCanvas();
    const obj = c?.getObjects().find((o) => o.emoId === id);
    if (!obj) return;

    const existingCard = pane.querySelector(
        `${SELECTORS.card}[data-canvas-id="${id}"]`,
    );
    if (existingCard) return;

    const card = createCardForObject(obj, tplEl, list);
    card?.querySelector(SELECTORS.simpleInput)?.focus();
  });

  window.addEventListener('emo:save', (e) => {
    const id = e.detail?.id;
    if (!id) return;

    const card = pane.querySelector(
        `${SELECTORS.card}[data-canvas-id="${id}"]`,
    );
    if (!card) return;

    card.classList.remove('is-editing');

    card.querySelectorAll('input').forEach((inp) => inp.blur());
    const c = getCanvas();
    if (c?.getActiveObject?.()) {
      c.discardActiveObject();
      c.requestRenderAll();
    }
  });

  /* ---------- Add new card manually ---------- */

  const makeNewCard = () => {
    const defaultSize = 10;
    const canvasId = addTextObject({ text: '', fontSize: defaultSize });

    selectObject(canvasId);
    setFontFamilyForActive(FONTS.aero.family);

    const card = cloneCardTemplate(tplEl);
    if (!card) return null;

    wireCard(
        card,
        canvasId,
        '',
        defaultSize,
        FONTS.aero.family,
    );

    list.appendChild(card);
    renumberCards(list);
    return card;
  };

  addBtn.addEventListener('click', () => {
    const card = makeNewCard();
    card?.querySelector(SELECTORS.simpleInput)?.focus();
  });

  /* ---------- Card-level events (edit/delete/size) ---------- */

  list.addEventListener('click', (e) => {
    const editBtn = e.target.closest(SELECTORS.editBtn);
    const backBtn = e.target.closest(SELECTORS.exitEditBtn);
    const delBtn  = e.target.closest(SELECTORS.deleteBtn);
    const sizeBtn = e.target.closest(SELECTORS.sizeBtn);

    if (editBtn) {
      const card = editBtn.closest(SELECTORS.card);
      if (!card) return;

      card.classList.add('is-editing');

      const id = card.dataset.canvasId;
      const simpleInput = card.querySelector(SELECTORS.simpleInput);
      const advInput    = card.querySelector(SELECTORS.advancedInput);

      if (advInput && simpleInput) {
        advInput.value = simpleInput.value;
        advInput.focus();
      }

      if (id) selectObject(id);
      return;
    }

    if (backBtn) {
      const card = backBtn.closest(SELECTORS.card);
      if (!card) return;

      card.classList.remove('is-editing');
      const id = card.dataset.canvasId;
      if (id) selectObject(id);
      return;
    }

    if (delBtn) {
      const card = delBtn.closest(SELECTORS.card);
      if (!card) return;

      const id = card.dataset.canvasId;
      if (id) removeObject(id);
      card.remove();
      renumberCards(list);
      return;
    }

    if (sizeBtn) {
      const card = sizeBtn.closest(SELECTORS.card);
      if (!card) return;

      const id = card.dataset.canvasId;
      if (!id) return;

      const input = card.querySelector(SELECTORS.sizeInput);
      let val = parseInt(input?.value, 10);
      if (Number.isNaN(val)) val = 10;

      const step = Number(sizeBtn.dataset.step) || 0;
      val = Math.min(200, Math.max(6, val + step));

      if (input) input.value = String(val);
      setFontSize(id, val);
    }
  });

  list.addEventListener('input', (e) => {
    const sizeInput = e.target.closest(SELECTORS.sizeInput);
    if (!sizeInput) return;

    const card = sizeInput.closest(SELECTORS.card);
    if (!card) return;

    const id = card.dataset.canvasId;
    if (!id) return;

    let val = parseInt(sizeInput.value, 10);
    if (Number.isNaN(val)) val = 10;
    val = Math.min(200, Math.max(6, val));
    sizeInput.value = String(val);

    setFontSize(id, val);
  });

  /* ---------- Initial cards from existing canvas objects ---------- */

  const existingTexts = canvas.getObjects().filter(
      (o) => o.emoKind === 'text' && o.emoId,
  );

  existingTexts.forEach((obj) => {
    const already = list.querySelector(
        `${SELECTORS.card}[data-canvas-id="${obj.emoId}"]`,
    );
    if (already) return;

    createCardForObject(obj, tplEl, list);
  });
}
