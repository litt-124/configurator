// panels/extension.js
import {
    readStepData,
    writeStepData,
    toggleDisabled,
    openRelatedCollapsesForPrefill,
    showAlert,
} from '../utils.js';

const PANE_ID      = 'pane-extension';
const NEXT_PANE_ID = null; // last step – no real "next", but we still fire an event if you want

export default function onExtensionTab(paneEl) {
    const form  = paneEl.querySelector('#extensionForm');
    if (!form) return;

    const items = [...form.querySelectorAll('.js-extension-item')];
    if (!items.length) return;

    // index them
    items.forEach((itemEl, idx) => {
        itemEl.dataset.extensionIndex = String(idx);
    });

    // wire Download preview button click (alert is added later)
    paneEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.js-download-preview-btn');
        if (!btn) return;

        const ev = new CustomEvent('configurator:download-preview', {
            detail: { stepId: PANE_ID },
        });
        document.dispatchEvent(ev);
    });

    // rehydrate saved state
    const saved = readStepData(PANE_ID);
    if (saved?.items?.length) {
        items.forEach((itemEl, idx) => {
            const data = saved.items[idx];
            if (!data) return;

            const chosenBtn = data.value
                ? itemEl.querySelector(
                    `.js-extension-choice[data-extension-value="${CSS.escape(data.value)}"]`
                )
                : null;

            if (chosenBtn) {
                markChoiceActive(itemEl, chosenBtn);
                itemEl.classList.add('is-completed');
            }
        });
    }

    gateChainFromSaved(items, paneEl);

    // wire per-item events
    items.forEach((itemEl, idx) => {
        wireItem(itemEl, idx, items, paneEl);
    });

    // global rehydrate (if flow replays later)
    document.addEventListener('configurator:rehydrate', (ev) => {
        const { stepId, data } = ev.detail || {};
        if (stepId !== PANE_ID || !data?.items) return;

        items.forEach((itemEl, idx) => {
            const v = data.items[idx];
            clearChoiceActive(itemEl);
            itemEl.classList.remove('is-completed');

            if (!v) return;

            const chosenBtn = v.value
                ? itemEl.querySelector(
                    `.js-extension-choice[data-extension-value="${CSS.escape(v.value)}"]`
                )
                : null;

            if (chosenBtn) {
                markChoiceActive(itemEl, chosenBtn);
                itemEl.classList.add('is-completed');
            }
        });

        gateChainFromSaved(items, paneEl);
    }, { once: true });
}

/* ================= helpers ================= */

function wireItem(itemEl, index, allItems, paneEl) {
    const saveBtn   = itemEl.querySelector('.js-extension-save');
    const choices   = [...itemEl.querySelectorAll('.js-extension-choice')];
    const collapseEl = itemEl.querySelector('.item-collapse');

    if (!saveBtn || !choices.length || !collapseEl) return;

    saveBtn.type = 'button';
    syncSaveButton(itemEl, saveBtn);

    // choose option
    choices.forEach((btn) => {
        btn.addEventListener('click', () => {
            if (itemEl.dataset.enabled !== '1') return;

            markChoiceActive(itemEl, btn);
            syncSaveButton(itemEl, saveBtn);
        });
    });

    // save + move to next
    saveBtn.addEventListener('click', (e) => {
        e.preventDefault();

        if (saveBtn.disabled || itemEl.dataset.enabled !== '1') return;

        const chosen = getActiveChoice(itemEl);
        if (!chosen) {
            showAlert('danger'); // "please choose option"
            return;
        }

        // persist this item
        persistItem(index, {
            value: chosen.dataset.extensionValue || null,
        });

        itemEl.classList.add('is-completed');

        const items = allItems;
        const next  = items[index + 1];

        if (next) {
            enableOnlyNext(items, index);
            const nextCollapse = next.querySelector('.item-collapse');
            setCollapseState(collapseEl, false);
            setCollapseState(nextCollapse, true);
            openRelatedCollapsesForPrefill(next);
        } else {
            // last item done
            enableOnlyNext(items, index);
            onAllCompleted(items, paneEl);
        }

        syncSaveButton(itemEl, saveBtn);
    });
}

function syncSaveButton(itemEl, saveBtn) {
    const enabled = itemEl.dataset.enabled === '1';
    const hasChoice = !!getActiveChoice(itemEl);
    toggleDisabled(saveBtn, !(enabled && hasChoice));
}

function getActiveChoice(itemEl) {
    return itemEl.querySelector('.js-extension-choice.is-active');
}

function markChoiceActive(itemEl, btn) {
    clearChoiceActive(itemEl);
    btn.classList.add('is-active');
}

function clearChoiceActive(itemEl) {
    itemEl.querySelectorAll('.js-extension-choice.is-active')
        .forEach(b => b.classList.remove('is-active'));
}

/* ===== gating / chain logic (like sizes) ===== */

function gateChainFromSaved(items, paneEl) {
    items.forEach((itemEl) => setItemEnabled(itemEl, false));

    let openedFirstIncomplete = false;

    items.forEach((itemEl, idx) => {
        const valid = !!getActiveChoice(itemEl);

        const collapseEl = itemEl.querySelector('.item-collapse');

        if (valid) {
            itemEl.classList.add('is-completed');
            setItemEnabled(itemEl, true);
            setCollapseState(collapseEl, false);
            return;
        }

        if (!openedFirstIncomplete) {
            setItemEnabled(itemEl, true);
            setCollapseState(collapseEl, true);
            openRelatedCollapsesForPrefill(itemEl);
            openedFirstIncomplete = true;
        } else {
            setCollapseState(collapseEl, false);
        }
    });

    if (items.length && items.every(it => !!getActiveChoice(it))) {
        items.forEach(it => setItemEnabled(it, true));
        onAllCompleted(items, paneEl);
    }
}

function enableOnlyNext(items, index) {
    items.forEach((itemEl, i) => {
        const shouldEnable = i <= index || i === index + 1;
        setItemEnabled(itemEl, shouldEnable);

        if (!shouldEnable) {
            const col = itemEl.querySelector('.item-collapse');
            setCollapseState(col, false);
        }
    });
}

function setItemEnabled(itemEl, enabled) {
    itemEl.dataset.enabled = enabled ? '1' : '0';
    itemEl.classList.toggle('is-disabled', !enabled);

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

    itemEl.querySelectorAll('button').forEach((btn) => {
        if (btn === toggle) return;
        btn.disabled = !enabled;
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
    const holder = collapseEl.closest('.js-extension-item') || document;

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

/* ===== storage ===== */

function persistItem(index, values) {
    let all = readStepData(PANE_ID) || { items: [] };
    while (all.items.length <= index) {
        all.items.push({});
    }

    all.items[index] = {
        value: values.value ?? null,
    };

    writeStepData(PANE_ID, all);
}

/* ===== when all done ===== */

function onAllCompleted(items, paneEl) {
    if (!items.length || !items.every(it => !!getActiveChoice(it))) {
        return;
    }

    // 1) Fire global step-complete event
    const data = readStepData(PANE_ID) || {};
    const ev = new CustomEvent('configurator:step-complete', {
        detail: {
            stepId: PANE_ID,
            nextStepId: null,
            data,
        },
    });
    document.dispatchEvent(ev);

    // 2) Use the shared alert util (success)
    showAlert(
        'success',
        `
        All extensions are configured.
        <br>
        <button class="btn btn-sm btn-success mt-2 js-download-preview-btn">
            Download preview
        </button>
        `,
        null
    );
}

