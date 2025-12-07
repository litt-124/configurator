import {
    toggleDisabled,
    readStepData,
    writeStepData,
    setCanvasBgAll,
    getCurrentBgFromAnyCanvas,
    openRelatedCollapsesForPrefill, showAlert,
} from '../utils.js';

const PANE_ID = 'pane-color';
const NEXT_PANE_ID = 'pane-size';

const SELECTORS = {
    form: '#colorForm',
    saveButton: '.js-save-button',
    colorRadios: 'input[name="color"]',
    colorItem: '.js-tab-content-item, .tab-content-item',
    mainThumb: '.js-main-thumb',
};

function getSelectedColor(form) {
    return form.querySelector(`${SELECTORS.colorRadios}:checked`);
}

function updateSaveButtonState(form, saveBtn) {
    const hasSelection = !!getSelectedColor(form);
    toggleDisabled(saveBtn, !hasSelection);
}

function getPreviewUrlFromInput(input) {
    if (!input) return null;

    const holder = input.closest(SELECTORS.colorItem);
    if (!holder) return null;

    const thumb =
        holder.querySelector(SELECTORS.mainThumb) ||
        holder.querySelector('img');

    if (!thumb) return null;

    // prefer explicit data attribute for bg
    return (
        thumb.dataset?.bg ||
        thumb.getAttribute?.('data-bg') ||
        thumb.currentSrc ||
        thumb.src ||
        null
    );
}

function rehydrateFromStorage(form) {
    const saved = readStepData(PANE_ID);
    if (!saved) return;

    // Restore selected color
    if (saved.colorInputId) {
        const prev = form.querySelector(`#${CSS.escape(saved.colorInputId)}`);
        if (prev) {
            prev.checked = true;
            openRelatedCollapsesForPrefill(prev);
        }
    }

    // Restore preview if present
    if (saved.previewUrl) {
        setCanvasBgAll(saved.previewUrl);
    }
}

function applySavedSelectionAndPreview(form) {
    const saved = readStepData(PANE_ID);
    if (!saved) return;

    if (saved.colorInputId) {
        const prev = form.querySelector(`#${CSS.escape(saved.colorInputId)}`);
        if (prev) {
            prev.checked = true;
            openRelatedCollapsesForPrefill(prev);
        }
    }

    if (saved.previewUrl) {
        setCanvasBgAll(saved.previewUrl);
    }
}

function attachRehydrateListener(form, saveBtn) {
    const onRehydrate = (ev) => {
        const { stepId } = ev.detail || {};
        if (stepId !== PANE_ID) return;

        applySavedSelectionAndPreview(form);
        updateSaveButtonState(form, saveBtn);
    };

    document.addEventListener('configurator:rehydrate', onRehydrate, { once: true });
}

export default function onColorTab(paneEl) {
    if (!paneEl || paneEl.id !== PANE_ID) {
        return;
    }

    const form =
        paneEl.querySelector(SELECTORS.form) ||
        paneEl.querySelector('form') ||
        paneEl;

    const saveBtn = paneEl.querySelector(SELECTORS.saveButton);

    if (!form || !saveBtn) {
        return;
    }

    const colorInputs = form.querySelectorAll(SELECTORS.colorRadios);
    if (colorInputs.length === 0) {
        return;
    }

    // Initial restore from storage, then update button state
    rehydrateFromStorage(form);
    updateSaveButtonState(form, saveBtn);

    // Live changes
    form.addEventListener('change', (event) => {
        const target = event.target;
        if (!target?.matches(SELECTORS.colorRadios)) {
            return;
        }

        // enable save once something is chosen
        updateSaveButtonState(form, saveBtn);

        // update preview
        const previewUrl = getPreviewUrlFromInput(target);
        if (previewUrl) {
            setCanvasBgAll(previewUrl);
        }
    });

    const handleSave = (event) => {
        event.preventDefault();

        const chosen = getSelectedColor(form);
        if (!chosen) {
            showAlert('danger');
            return;
        }

        const previewUrl =
            getCurrentBgFromAnyCanvas() ||
            getPreviewUrlFromInput(chosen) ||
            null;

        const data = {
            colorInputId: chosen.id,
            value: chosen.value,
            previewUrl,
        };

        writeStepData(PANE_ID, data);

        const ev = new CustomEvent('configurator:step-complete', {
            detail: {
                stepId: PANE_ID,
                nextStepId: NEXT_PANE_ID,
                data,
            },
        });

        document.dispatchEvent(ev);
    };

    saveBtn.addEventListener('click', handleSave);
    form.addEventListener('submit', handleSave);

    attachRehydrateListener(form, saveBtn);
}
