// ./panels/text.js
import {
  initCanvas, getCanvas,
  addTextObject, updateTextObject, removeObject, selectObject,setTextAlign, setFontSize
} from '../canvas.js';

export default function onTextTab(pane) {
  if (pane.dataset.inited === '1') return;
  pane.dataset.inited = '1';

  // ensure there is a canvas
  initCanvas();

  // 🔄 sync FROM canvas selection -> focus the matching card input in THIS pane
  const c = getCanvas();
  const syncFromCanvas = () => {
    const active = c.getActiveObject();
    if (!active || !active.emoId) return;
    const card = pane.querySelector(`.js-text-card[data-canvas-id="${active.emoId}"]`);
    if (!card) return;
    const input = card.classList.contains('is-editing')
      ? card.querySelector('.text-card__advanced input.form-control')
      : card.querySelector('.text-card__simple input.form-control');
    input?.focus();
      const sizeInput = card.querySelector('.size-stepper input');
  if (sizeInput && typeof active.fontSize === 'number') {
    sizeInput.value = String(Math.round(active.fontSize));
  }
  };
  c.on('selection:created', syncFromCanvas);
  c.on('selection:updated', syncFromCanvas);

  // hooks inside this pane only
  const addBtn = pane.querySelector('.js-add-text');
  const list   = pane.querySelector('.js-text-list');
  const tplEl  = pane.querySelector('#text-card-tpl');
  if (!addBtn || !list || !tplEl) return;

  let counter = 0;

  const makeCard = () => {
    counter += 1;
    const html = tplEl.textContent.trim().replaceAll('__N__', String(counter));
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const card = wrap.firstElementChild;
  const defaultSize = 10;

    // create a canvas text object and link it to the card
    const canvasId = addTextObject({ text: '' ,fontSize:defaultSize});
    card.dataset.canvasId = canvasId;

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
  const sizeBtn  = e.target.closest('.size-stepper .btn');

  // ✅ NEW: alignment buttons
  const alignBtn = e.target.closest('.align-group .btn');
  if (alignBtn) {
    const card = alignBtn.closest('.js-text-card');
    const id = card?.dataset.canvasId;
    if (!id) return;

    // read desired alignment from data-align if present, else from title
    const align =
      alignBtn.dataset.align ||
      (alignBtn.getAttribute('data-align') || '').toLowerCase(); // 'left'|'center'|'right'
console.log("lalala", align);

    if (align === 'left' || align === 'center' || align === 'right') {
      setTextAlign(id, align);

      // toggle active state visually within this group
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
  if(sizeBtn){
const card = sizeBtn.closest('.js-text-card');
  const id = card?.dataset.canvasId;
  if (!id) return;

  const input = card.querySelector('.size-stepper input');
  let val = parseInt(input?.value, 10);
  if (Number.isNaN(val)) val = 10;

  // infer step: use data-step if provided, else look at the <use href>
  let step = Number(sizeBtn.dataset.step);
  if (!step) {
    const href = sizeBtn.querySelector('use')?.getAttribute('href') || '';
    step = href.includes('plus') ? 1 : -1; // #i-plus / #i-minus
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