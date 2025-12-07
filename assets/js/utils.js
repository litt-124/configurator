import {FONTS} from "./panels/text.js";

const ACTIVE_TAB_KEY = 'ptab';
const ENABLED_KEY = 'cfg.enabledTabs';
const DATA_PREFIX = 'cfg.data.';
// utils.js

import {
  applyFabricCanvasSize,
  applyCanvasSize,
} from './panels/size.js'; // adjust path if needed

import {
  setCanvasBgPatternFromUrl,
  getCurrentBgUrl,
  clearCanvasMask,
  setCanvasMaskFromSvgUrl,
  setRoundedRectMask,
  resetBackgroundCornerRadius,
  getCanvas,
  addTextObject, ensureFontLoaded,addSvgFromMarkup,
} from './canvas.js';



export function setCanvasBgAll(url) {
  setCanvasBgPatternFromUrl(url);
}

export function getCurrentBgFromAnyCanvas() {
  return getCurrentBgUrl();
}

// --- session: tabs ---
export function getActiveTab() {
  return sessionStorage.getItem(ACTIVE_TAB_KEY) || null;
}
export function setActiveTab(id) {
  sessionStorage.setItem(ACTIVE_TAB_KEY, id);
}

export function getEnabledTabs(order = []) {
  try {
    const raw = sessionStorage.getItem(ENABLED_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    const clean = Array.isArray(arr) ? arr : null;
    return clean ? (order.length ? clean.filter(x => order.includes(x)) : clean) : [];
  } catch {
    return [];
  }
}
export function setEnabledTabs(arr) {
  sessionStorage.setItem(ENABLED_KEY, JSON.stringify(arr || []));
}

// --- session: per-step data ---
export function readStepData(stepId) {
  try {
    const raw = sessionStorage.getItem(DATA_PREFIX + stepId);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function writeStepData(stepId, data) {
  try { sessionStorage.setItem(DATA_PREFIX + stepId, JSON.stringify(data)); }
  catch {}
}

// --- small DOM utils ---
export function toggleDisabled(el, disabled) {
  if (!el) return;
  if (disabled) {
    el.setAttribute('disabled', 'true');
    el.classList.add('disabled');
  } else {
    el.removeAttribute('disabled');
    el.classList.remove('disabled');
  }
}

// --- open collapses when prefilling a saved selection ---
export function openRelatedCollapsesForPrefill(el) {
  if (!el) return;

  // Collect collapses: ancestors + those inside the same item block
  const toOpen = new Set();

  // 1) any ancestor .collapse (nested accordions supported)
  let n = el.parentElement;
  while (n) {
    if (n.classList && n.classList.contains('collapse')) toOpen.add(n);
    n = n.parentElement;
  }

  // 2) all collapses inside the nearest tab-content item
  const holder = el.closest('.js-tab-content-item, .tab-content-item');
  if (holder) {
    holder.querySelectorAll('.collapse').forEach(c => toOpen.add(c));
  }

  // Open them (Bootstrap-aware, with no-jQuery fallback)
  toOpen.forEach(c => {
    if (window.bootstrap?.Collapse) {
      window.bootstrap.Collapse.getOrCreateInstance(c, { toggle: false }).show();
    } else {
      // Fallback: mimic shown state
      c.classList.add('show');
      c.style.height = '';
      // Update toggles targeting this collapse
      const sel = `[data-bs-target="#${c.id}"], a[href="#${c.id}"]`;
      holder?.querySelectorAll(sel).forEach(t => {
        t.classList.remove('collapsed');
        t.setAttribute('aria-expanded', 'true');
      });
    }
  });
}
const DEFAULT_TEXT = {
  success: 'Your changes were saved successfully.',
  warning:    'Here is some warning.',
  danger:  'Please fix the required fields.',
};

export function showAlert(type, text = null, autoCloseMs = 4000) {
  const container = document.querySelector('[data-alert-container]');
  if (!container) return;

  container.innerHTML = '';

  const tpl = document.querySelector(`#tpl-alert-${type}`);
  if (!tpl) return;

  const clone = tpl.content.firstElementChild.cloneNode(true);

  clone.querySelector('.alert-text').textContent =
      text || DEFAULT_TEXT[type];
  container.appendChild(clone);

  if (autoCloseMs != null) {
    setTimeout(() => {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(clone);
      bsAlert.close();
    }, autoCloseMs);
  }
}


export const STEP_IDS = {
  PRODUCT: 'pane-product',
  COLOR:   'pane-color',
  SIZE:    'pane-size',
  TEXT:    'pane-text',
  IMAGE:   'pane-image',
};

/**
 * Rebuild the *visual* workspace preview from saved step data.
 * Called once on page load, before/without opening any specific tab.
 */
export async function rehydrateInitialPreview() {
  const colorSaved = readStepData(STEP_IDS.COLOR);
  if (colorSaved?.previewUrl) {
    setCanvasBgAll(colorSaved.previewUrl);
  }

  const sizeSaved = readStepData(STEP_IDS.SIZE);
  const items     = sizeSaved?.items || [];
  const plate0    = items[0];
  const plate1    = items[1];

  if (plate0 && plate0.widthMm && plate0.heightMm) {
    applyCanvasSize(plate0.widthMm, plate0.heightMm);
  }
  if (plate1 && plate1.widthMm && plate1.heightMm) {
    applyFabricCanvasSize(plate1.widthMm, plate1.heightMm);
  }

  if (sizeSaved?.shape) {
    const shape = sizeSaved.shape;
    const pct   = sizeSaved.roundedPct ?? 0;

    if (shape === 'rectangle') {
      resetBackgroundCornerRadius();
      if (pct > 0) {
        setRoundedRectMask(pct);
      } else {
        clearCanvasMask();
      }
    } else {
      resetBackgroundCornerRadius();
      const maskUrl = sizeSaved.shapeMask;
      if (maskUrl) {
        try {
          await setCanvasMaskFromSvgUrl(maskUrl);
        } catch {
          clearCanvasMask();
        }
      } else {
        clearCanvasMask();
      }
    }
  }

  // 🔥 TEXT PART: now truly awaited
  const textSaved = readStepData(STEP_IDS.TEXT);
  if (textSaved && Array.isArray(textSaved.items) && textSaved.items.length) {
    try {
      await ensureFontLoaded(FONTS.aero.family, FONTS.aero.url);
    } catch {
      // even if font fails, still place texts
    }

    const c = getCanvas();
    textSaved.items.forEach((item) => {
      const opts = {
        emoId:      item.id || item.emoId,
        text:       item.text || '',
        fontSize:   typeof item.fontSize === 'number' ? item.fontSize : 10,
        left:       typeof item.left === 'number' ? item.left : null,
        top:        typeof item.top === 'number' ? item.top : null,
        angle:      typeof item.angle === 'number' ? item.angle : 0,
        align:      item.align || 'left',
        flipX:      !!item.flipX,
        flipY:      !!item.flipY,
        fontFamily: item.fontFamily || FONTS.aero.family,
      };

      addTextObject(opts);
    });

    c.requestRenderAll();
  }


  const imageSaved = readStepData(STEP_IDS.IMAGE);
  if (imageSaved && Array.isArray(imageSaved.items) && imageSaved.items.length) {
    const c = getCanvas();

    for (const img of imageSaved.items) {
      if (!img) continue;

      // skip entries with no usable SVG
      if (typeof img.svg !== 'string' || !img.svg.trim()) {
        continue;
      }

      await addSvgFromMarkup(img.svg, {
        emoId: img.id,
        left:  typeof img.left === 'number' ? img.left : undefined,
        top:   typeof img.top === 'number' ? img.top : undefined,
        angle: img.angle || 0,
        scaleX: img.scaleX || 1,
        scaleY: img.scaleY || 1,
      });
    }

    c.requestRenderAll();
  }



}


