// panels/size.js
import {
    toggleDisabled,
    readStepData,
    writeStepData,
    openRelatedCollapsesForPrefill,
    showAlert
} from '../utils.js';

import {
    clearCanvasMask,
    getCanvas,
    refitBgPatternToCanvas,
    refitCanvasMaskToCanvas,
    setCanvasMaskFromSvgUrl,
    setRoundedRectMask,
    resetBackgroundCornerRadius, // used to keep pattern rect sharp for non-rect shapes
} from '../canvas.js';

const PANE_ID      = 'pane-size';
const NEXT_PANE_ID = 'pane-text';
const SIZE_MIN_MM  = 30;
const SIZE_MAX_MM  = 3000;

/* ============================ Small helpers ============================ */

function clampPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
}

/**
 * Apply rounded corners based on slider, but only when current shape supports it
 * (rectangle). For other shapes this is a no-op.
 */
function applyRoundedFromSliderIfRectangle(root = document) {
    const stepEl = root.querySelector('[data-shape-step]');
    if (!stepEl) return;

    const activeTile = stepEl.querySelector('[data-shape-tile].is-active');
    if (!activeTile) return;

    const slider = root.querySelector('[data-rounded-slider]');
    if (!slider) return;

    const supportsRounded = activeTile.getAttribute('data-supports-rounded') === 'true';

    // Only act when shape supports rounded corners (rectangle).
    if (!supportsRounded) {
        return;
    }

    const pct = clampPercent(slider.value);

    if (pct === 0) {
        // 0% → plain rectangle (no rounded mask)
        clearCanvasMask();
    } else {
        // >0% → apply rounded-rect mask
        setRoundedRectMask(pct);
    }
}
function getGlobalShapeState(root = document) {
    const stepEl = root.querySelector('[data-shape-step]');
    const slider = root.querySelector('[data-rounded-slider]');

    let shape      = null;
    let roundedPct = null;
    let maskUrl    = null;

    if (stepEl) {
        const activeTile = stepEl.querySelector('[data-shape-tile].is-active');
        if (activeTile) {
            shape   = activeTile.getAttribute('data-shape') || null;
            maskUrl = activeTile.getAttribute('data-shape-mask') || null;

            const supportsRounded = activeTile.getAttribute('data-supports-rounded') === 'true';
            if (supportsRounded && slider) {
                roundedPct = clampPercent(slider.value);
            }
        }
    }

    return { shape, roundedPct, maskUrl };
}
function persistGlobalShapeState(existingData = null, root = document) {
    // Keep existing items if passed, or read from storage
    const all = existingData || readStepData(PANE_ID) || { items: [] };

    const { shape, roundedPct, maskUrl } = getGlobalShapeState(root);

    all.shape      = shape ?? null;
    all.roundedPct = (typeof roundedPct === 'number') ? roundedPct : null;
    all.shapeMask  = maskUrl ?? null;

    writeStepData(PANE_ID, all);
    return all;
}


/* ============================ Main entry ============================ */

export default function onSizeTab(paneEl) {
    const listEl = paneEl.querySelector('.js-size-list') || paneEl.querySelector('.tab-content-inner');
    if (!listEl) return;

    const templateEl = paneEl.querySelector('[data-size-template]');
    const backItem   = listEl.querySelector('.js-tab-content-item');
    if (!backItem) return;

    let product = readStepData('pane-product') || null;

    renderFromProduct(product);

    // Rebuild when product is rehydrated/changed
    const onRehydrateProduct = (ev) => {
        const { stepId, data } = ev.detail || {};
        if (stepId !== 'pane-product') return;
        product = data || null;
        renderFromProduct(product);
    };
    document.addEventListener('configurator:rehydrate', onRehydrateProduct);

    initShapeStep(paneEl);
    initRoundedSlider(paneEl);

    function renderFromProduct(prod) {
        const plateCount   = getPlateCountFromProduct(prod); // 1..N
        const dynamicCount = Math.max(plateCount - 1, 0);    // exclude back

        renderDynamicItems(listEl, templateEl, dynamicCount);

        const items = [...listEl.querySelectorAll('.js-tab-content-item')];

        items.forEach((itemEl, idx) => {
            itemEl.dataset.sizeIndex = String(idx);
            setupItemStructure(itemEl, idx);
        });

        // 1) Rehydrate saved data (fills inputs + marks .is-completed)
        rehydrateAll(items);

        // 2) Gate chain based on valid/incomplete
        gateChainFromSaved(items);

        // 3) Wire events (Save/Next, shape, range, etc.)
        items.forEach((itemEl, idx) => wireItem(itemEl, idx, items.length, listEl));
    }
}

/* ============================ Validation ============================ */

function validateForSubmit(values, listEl) {
    // 1) Basic numeric bounds
    if (!validateSizes(values.widthMm, values.heightMm)) {
        showAlert("danger", "Width or Height is outside allowed limits.");
        return false;
    }

    // 2) Plate order (each next smaller than previous)
    const items = [...listEl.querySelectorAll('.js-tab-content-item')];
    const order = validatePlateOrder(items);
    if (order.error) {
        showAlert("danger", `Plate ${order.index + 1} must be smaller than the previous one.`);
        return false;
    }

    return true;
}

function validatePlateOrder(items) {
    let prev = null;

    for (let i = 0; i < items.length; i++) {
        const { widthMm, heightMm } = getItemValues(items[i]);
        if (!validateSizes(widthMm, heightMm)) continue;

        if (prev) {
            if (widthMm >= prev.widthMm || heightMm >= prev.heightMm) {
                return { error: true, index: i };
            }
        }
        prev = { widthMm, heightMm };
    }
    return { error: false };
}

/* ============================ Canvas sizing ============================ */

export function applyCanvasSize(widthMm, heightMm) {
    const wrapper = document.querySelector('.canvas-outer');

    if (wrapper) {
        wrapper.style.setProperty('--canvas-width-mm', widthMm);
        wrapper.style.setProperty('--canvas-height-mm', heightMm);

        wrapper.style.width  = `min(95vw, ${widthMm}px)`;
        wrapper.style.height = `min(80vh, ${heightMm}px)`;
    }
}

export function applyFabricCanvasSize(widthMm, heightMm) {
    const canvas = getCanvas?.();
    if (!canvas) return;

    canvas.setWidth(widthMm);
    canvas.setHeight(heightMm);

    refitCanvasMaskToCanvas();
    refitBgPatternToCanvas();
}

/* ============================ Shape + Rounded UI ============================ */

export function initShapeStep(root = document) {
    const stepEl = root.querySelector('[data-shape-step]');
    if (!stepEl) return;

    const shapeTiles     = stepEl.querySelectorAll('[data-shape-tile]');
    const shapeLabelEl   = stepEl.querySelector('[data-shape-label]');
    const roundedSection = root.querySelector('[data-rounded-section]');

    const saved = readStepData(PANE_ID); // ⬅️ NEW

    const applyShape = (tile) => {
        const shape              = tile.getAttribute('data-shape');
        const uiLabel            = tile.getAttribute('data-shape-label') || shape;
        const maskUrl            = tile.getAttribute('data-shape-mask');
        const supportsRoundedStr = tile.getAttribute('data-supports-rounded');
        const supportsRounded    = supportsRoundedStr === 'true';

        // 1) UI active
        shapeTiles.forEach(btn => btn.classList.remove('is-active'));
        tile.classList.add('is-active');

        // 2) header label
        if (shapeLabelEl) {
            shapeLabelEl.textContent = uiLabel;
        }

        // 3) rounded corners UI visibility
        if (roundedSection) {
            roundedSection.classList.toggle('d-none', !supportsRounded);
        }

        // 4) Canvas behaviour
        if (shape === 'rectangle') {
            applyRoundedFromSliderIfRectangle(root);
        } else {
            resetBackgroundCornerRadius();
            if (maskUrl) {
                setCanvasMaskFromSvgUrl(maskUrl);
            } else {
                clearCanvasMask();
            }
        }

        // 5) Persist current shape + rounded + mask into session
        persistGlobalShapeState(null, root);
    };


    shapeTiles.forEach(tile => {
        tile.addEventListener('click', () => applyShape(tile));
    });

    // ⬇️ NEW: prefer saved shape, fall back to current/first
    let initialActive = null;

    if (saved?.shape) {
        initialActive = stepEl.querySelector(
            `[data-shape-tile][data-shape="${saved.shape}"]`
        );
    }

    if (!initialActive) {
        initialActive =
            stepEl.querySelector('[data-shape-tile].is-active') || shapeTiles[0];
    }

    if (initialActive) {
        applyShape(initialActive);
    }
}


export function initRoundedSlider(root = document) {
    const slider  = root.querySelector('[data-rounded-slider]');
    const valueEl = root.querySelector('[data-rounded-value]');
    if (!slider || !valueEl) return;

    // ⬇️ NEW: load saved roundedPct, if any
    const saved = readStepData(PANE_ID);
    if (typeof saved?.roundedPct === 'number') {
        const pct = clampPercent(saved.roundedPct);
        slider.value = String(pct);
    }

    const update = () => {
        valueEl.textContent = `${slider.value}%`;
        applyRoundedFromSliderIfRectangle(root);

        // ⬇️ NEW: persist new rounded value + shape + mask
        persistGlobalShapeState(null, root);
    };

    slider.addEventListener('input', update);
    slider.addEventListener('change', update);
    update();
}



/* ============================ Rendering dynamic items ============================ */

function renderDynamicItems(listEl, templateEl, dynamicCount) {
    const existing = [...listEl.querySelectorAll('.js-tab-content-item')];
    existing.slice(1).forEach((el) => el.remove());

    if (!templateEl || dynamicCount <= 0) return;

    for (let i = 1; i <= dynamicCount; i++) {
        const clone = templateEl.content.firstElementChild.cloneNode(true);
        listEl.appendChild(clone);
    }
}

function setupItemStructure(itemEl, index) {
    const numEl   = itemEl.querySelector('[data-size-num]');
    const titleEl = itemEl.querySelector('[data-size-title]');

    if (numEl)   numEl.textContent   = String(index + 1);
    if (titleEl) titleEl.textContent = index === 0 ? 'Back Plate' : `${ordinalTitle(index)} Plate`;

    const collapseEl = itemEl.querySelector('[data-size-collapse]');
    const toggleEl   = itemEl.querySelector('[data-size-collapse-toggle]');

    if (collapseEl) {
        const collapseId = `size${index + 1}`;
        collapseEl.id = collapseId;

        if (toggleEl) {
            toggleEl.setAttribute('data-bs-target', `#${collapseId}`);
            toggleEl.setAttribute('aria-controls', collapseId);
        }
    }

    const { widthEl, heightEl } = resolveSizeInputs(itemEl);
    if (widthEl) {
        widthEl.id   = `sizes-${index}-widthMm`;
        widthEl.name = `sizes[${index}][widthMm]`;
    }
    if (heightEl) {
        heightEl.id   = `sizes-${index}-heightMm`;
        heightEl.name = `sizes[${index}][heightMm]`;
    }
}

function ordinalTitle(n) {
    const words = [
        'First', 'Second', 'Third', 'Fourth', 'Fifth',
        'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth',
    ];
    return words[n] || `${n + 1}th`;
}

/* ============================ Wiring + gating ============================ */

function wireItem(itemEl, index, totalCount, listEl) {
    const saveBtn = itemEl.querySelector('.js-save-size-button');
    const nextBtn = itemEl.querySelector('.js-next-size-button');

    const { widthEl, heightEl } = resolveSizeInputs(itemEl);
    const collapseEl            = itemEl.querySelector('[data-size-collapse]');

    if (!saveBtn || !nextBtn || !widthEl || !heightEl || !collapseEl) return;

    saveBtn.type = 'button';
    nextBtn.type = 'button';

    const getAllItems = () => [...listEl.querySelectorAll('.js-tab-content-item')];

    // Shape + rounded range inside each item (for old per-item UI)
    wireShapeAndRounded(itemEl);

    const syncButtons = () => {
        const values  = getItemValues(itemEl);
        const ok      = validateSizes(values.widthMm, values.heightMm);
        const enabled = itemEl.dataset.enabled === '1';
        const done    = itemEl.classList.contains('is-completed');

        toggleDisabled(saveBtn, !(enabled && ok));
        toggleDisabled(nextBtn, !(enabled && ok && done));
    };

    syncButtons();

    const onFieldChange = () => syncButtons();
    widthEl.addEventListener('input', onFieldChange);
    heightEl.addEventListener('input', onFieldChange);
    widthEl.addEventListener('change', onFieldChange);
    heightEl.addEventListener('change', onFieldChange);

    // SAVE
    saveBtn.addEventListener('click', (e) => {
        e.preventDefault();

        const values = getItemValues(itemEl);

        if (!validateForSubmit(values, listEl)) {
            return;
        }

        if (index === 0) {
            applyCanvasSize(values.widthMm, values.heightMm);
        } else {
            applyFabricCanvasSize(values.widthMm, values.heightMm);
        }

        persistItem(index, values);
        itemEl.classList.add('is-completed');

        const items = getAllItems();
        enableOnlyNext(items, index);
        syncButtons();
    });

    nextBtn.addEventListener('click', (e) => {
        e.preventDefault();

        const values = getItemValues(itemEl);

        if (!validateForSubmit(values, listEl)) {
            return;
        }

        if (index === 0) {
            applyCanvasSize(values.widthMm, values.heightMm);
        } else {
            applyFabricCanvasSize(values.widthMm, values.heightMm);
        }

        persistItem(index, values);
        itemEl.classList.add('is-completed');

        const items    = getAllItems();
        const nextItem = items[index + 1];

        if (nextItem && nextItem.dataset.enabled === '1') {
            const nextCollapse = nextItem.querySelector('[data-size-collapse]');
            setCollapseState(collapseEl, false);
            setCollapseState(nextCollapse, true);
            focusFirstInput(nextItem);
        } else {
            maybeAutoAdvance(items, listEl);
        }

        syncButtons();
    });
}

function wireShapeAndRounded(itemEl) {
    const shapeBtn = itemEl.querySelector('[data-shape-btn]');
    if (shapeBtn) {
        itemEl.querySelectorAll('[data-shape]').forEach((btn) => {
            btn.addEventListener('click', () => {
                shapeBtn.textContent = btn.textContent.trim();
            });
        });
    }

    const rangeEl = itemEl.querySelector('[data-rounded-range]');
    const labelEl = itemEl.querySelector('[data-rounded-label]');

    if (rangeEl && labelEl) {
        const updateLabel = () => {
            labelEl.textContent = `${rangeEl.value}%`;
        };
        updateLabel();
        rangeEl.addEventListener('input', updateLabel);
        rangeEl.addEventListener('change', updateLabel);
    }
}

/* ============================ Gating core ============================ */

function gateChainFromSaved(items) {
    items.forEach((it) => setItemEnabled(it, false));

    let openedFirstIncomplete = false;

    items.forEach((itemEl) => {
        const valid = isItemValid(itemEl);

        if (valid) {
            itemEl.classList.add('is-completed');
            setItemEnabled(itemEl, true);
            const col = itemEl.querySelector('[data-size-collapse]');
            if (col) setCollapseState(col, false);
            return;
        }

        if (!openedFirstIncomplete) {
            setItemEnabled(itemEl, true);
            const col = itemEl.querySelector('[data-size-collapse]');
            if (col) setCollapseState(col, true);
            openRelatedCollapsesForPrefill(itemEl);
            openedFirstIncomplete = true;
        } else {
            const col = itemEl.querySelector('[data-size-collapse]');
            if (col) setCollapseState(col, false);
        }
    });

    if (items.every(isItemValid)) {
        items.forEach((it) => setItemEnabled(it, true));
    }
}

function enableOnlyNext(items, index) {
    items.forEach((itemEl, i) => {
        const shouldEnable = i <= index || i === index + 1;
        setItemEnabled(itemEl, shouldEnable);

        if (!shouldEnable) {
            const col = itemEl.querySelector('[data-size-collapse]');
            if (col) setCollapseState(col, false);
        }
    });
}

/* ============================ Rehydrate & step advance ============================ */

function rehydrateAll(items) {
    const saved = readStepData(PANE_ID);

    items.forEach((itemEl, idx) => {
        const v = saved?.items?.[idx];

        const { widthEl, heightEl } = resolveSizeInputs(itemEl);
        if (!widthEl || !heightEl) return;

        if (v) {
            if (v.widthMm  != null) widthEl.value  = v.widthMm;
            if (v.heightMm != null) heightEl.value = v.heightMm;

            const shapeBtn = itemEl.querySelector('[data-shape-btn]');
            if (shapeBtn && v.shape) shapeBtn.textContent = prettyShape(v.shape);

            const rangeEl = itemEl.querySelector('[data-rounded-range]');
            const labelEl = itemEl.querySelector('[data-rounded-label]');
            if (rangeEl && typeof v.roundedPct === 'number') {
                rangeEl.value = String(v.roundedPct);
                if (labelEl) labelEl.textContent = `${v.roundedPct}%`;
            }

            if (validateSizes(v.widthMm, v.heightMm)) {
                itemEl.classList.add('is-completed');
            } else {
                itemEl.classList.remove('is-completed');
            }
        } else {
            itemEl.classList.remove('is-completed');
        }
    });
}

function maybeAutoAdvance(items, listEl) {
    if (!items.length) return;
    if (!items.every(isItemValid)) return;

    const data = collectAllItems(listEl);
    writeStepData(PANE_ID, data);

    const ev = new CustomEvent('configurator:step-complete', {
        detail: {
            stepId: PANE_ID,
            nextStepId: NEXT_PANE_ID,
            data,
        },
    });
    document.dispatchEvent(ev);
}

/* ============================ Enable/Disable & Collapse ============================ */

function setItemEnabled(itemEl, enabled) {
    itemEl.dataset.enabled = enabled ? '1' : '0';

    const toggle = itemEl.querySelector('[data-size-collapse-toggle]');
    if (toggle) {
        toggle.classList.toggle('disabled', !enabled);
        toggle.setAttribute('aria-disabled', String(!enabled));
        toggle.onclick = (e) => {
            if (toggle.getAttribute('aria-disabled') === 'true') {
                e.preventDefault();
                e.stopPropagation();
            }
        };
    }

    itemEl.querySelectorAll('input, select, button').forEach((el) => {
        if (el === toggle) return;
        el.disabled = !enabled;
    });
}

function setCollapseState(collapseEl, show) {
    if (!collapseEl) return;

    if (window.bootstrap?.Collapse) {
        const inst = window.bootstrap.Collapse.getOrCreateInstance(collapseEl, { toggle: false });
        show ? inst.show() : inst.hide();
    } else {
        collapseEl.classList.toggle('show', !!show);
        collapseEl.style.height = '';
    }

    const id     = collapseEl.id;
    const holder = collapseEl.closest('.js-tab-content-item') || document;

    holder.querySelectorAll(`[data-bs-target="#${id}"], a[href="#${id}"]`).forEach((t) => {
        if (show) {
            t.classList.remove('collapsed');
            t.setAttribute('aria-expanded', 'true');
        } else {
            t.classList.add('collapsed');
            t.setAttribute('aria-expanded', 'false');
        }
    });
}

/* ============================ Data helpers ============================ */

function resolveSizeInputs(itemEl) {
    return {
        widthEl:  itemEl.querySelector('[data-size-width]'),
        heightEl: itemEl.querySelector('[data-size-height]'),
    };
}

function getItemValues(itemEl) {
    const { widthEl, heightEl } = resolveSizeInputs(itemEl);
    const shapeBtn = itemEl.querySelector('[data-shape-btn]');
    const rangeEl  = itemEl.querySelector('[data-rounded-range]');

    return {
        widthMm:    numberOrNull(widthEl?.value),
        heightMm:   numberOrNull(heightEl?.value),
        shape:      shapeBtn ? shapeBtn.textContent.trim().toLowerCase() : null,
        roundedPct: rangeEl ? numberOrNull(rangeEl.value) : null,
    };
}

function collectAllItems(listEl, root = document) {
    const items = [...listEl.querySelectorAll('.js-tab-content-item')];
    const data = {
        items: items.map((itemEl) => getItemValues(itemEl)),
    };

    const { shape, roundedPct } = getGlobalShapeState(root);
    data.shape      = shape ?? null;
    data.roundedPct = (typeof roundedPct === 'number') ? roundedPct : null;

    return data;
}



function persistItem(index, values, root = document) {
    let all = readStepData(PANE_ID) || { items: [] };
    while (all.items.length <= index) all.items.push({});

    // keep per-item data (for backwards compatibility)
    all.items[index] = {
        widthMm:    values.widthMm ?? null,
        heightMm:   values.heightMm ?? null,
        shape:      values.shape ?? null,
        roundedPct: values.roundedPct ?? null,
    };

    // Also persist global shape + rounded + mask
    persistGlobalShapeState(all, root);
}



/* ============================ Validators & misc ============================ */

function validateSizes(w, h) {
    const wn = Number(w);
    const hn = Number(h);
    if (!Number.isFinite(wn) || !Number.isFinite(hn)) return false;
    if (wn < SIZE_MIN_MM || hn < SIZE_MIN_MM) return false;
    return !(wn > SIZE_MAX_MM || hn > SIZE_MAX_MM);

}

function numberOrNull(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function prettyShape(s) {
    return (s || '').trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

function focusFirstInput(itemEl) {
    const inp = itemEl.querySelector('input, select, button');
    if (inp) inp.focus({ preventScroll: true });
}

function isItemValid(itemEl) {
    const { widthEl, heightEl } = resolveSizeInputs(itemEl);
    return validateSizes(widthEl?.value, heightEl?.value);
}

/* ============================ Product -> plate count ============================ */

function getPlateCountFromProduct(productData) {
    const id = productData?.productInputId || '';
    const m  = id.match(/p(\d+)/i);
    if (m) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && n >= 1) return n;
    }

    const val = (productData?.value || '').toLowerCase();
    if (val.includes('5')) return 5;
    if (val.includes('4')) return 4;
    if (val.includes('3')) return 3;
    if (val.includes('2')) return 2;
    return 1;
}
