import {
    toggleDisabled,
    readStepData,
    openRelatedCollapsesForPrefill,
    showAlert,
} from '../utils.js';

const PANE_ID = 'pane-product';
const NEXT_PANE_ID = 'pane-color';

const SELECTORS = {
    form: '#productForm',
    saveButton: '.js-save-button',
    productRadios: 'input[name="product"]',
};

function getSelectedProduct(form) {
    return form.querySelector(SELECTORS.productRadios + ':checked');
}

function updateSaveButtonState(form, saveBtn) {
    const hasSelection = !!getSelectedProduct(form);
    toggleDisabled(saveBtn, !hasSelection);
}

function rehydrateFromStorage(form) {
    const saved = readStepData(PANE_ID);
    if (!saved?.productInputId) return;

    const prev = form.querySelector(`#${CSS.escape(saved.productInputId)}`);
    if (!prev) return;

    prev.checked = true;
    // open corresponding collapse, if helper supports it
    openRelatedCollapsesForPrefill(prev);
}

function attachRehydrateListener(form, saveBtn) {
    const onRehydrate = (ev) => {
        const { stepId, data } = ev.detail || {};
        if (stepId !== PANE_ID || !data?.productInputId) return;

        const prev = form.querySelector(`#${CSS.escape(data.productInputId)}`);
        if (prev) {
            prev.checked = true;
            openRelatedCollapsesForPrefill(prev);
        }

        updateSaveButtonState(form, saveBtn);
    };

    document.addEventListener('configurator:rehydrate', onRehydrate, { once: true });
}

export default function onProductTab(paneEl) {
    if (!paneEl || paneEl.id !== PANE_ID) {
        return;
    }

    const form = paneEl.querySelector(SELECTORS.form);
    const saveBtn = paneEl.querySelector(SELECTORS.saveButton);

    if (!form || !saveBtn) {
        return;
    }

    rehydrateFromStorage(form);
    updateSaveButtonState(form, saveBtn);

    form.addEventListener('change', (event) => {
        if (event.target.matches(SELECTORS.productRadios)) {
            openRelatedCollapsesForPrefill(event.target);
        }

        updateSaveButtonState(form, saveBtn);
    });

    const handleSave = (event) => {
        event.preventDefault();

        const chosen = getSelectedProduct(form);

        if (!chosen) {
            showAlert('danger');
            return;
        }

        const data = {
            productInputId: chosen.id,
            value: chosen.value,
        };

        const stepCompleteEvent = new CustomEvent('configurator:step-complete', {
            detail: {
                stepId: PANE_ID,
                nextStepId: NEXT_PANE_ID,
                data,
            },
        });

        showAlert('success');
        document.dispatchEvent(stepCompleteEvent);
    };

    saveBtn.addEventListener('click', handleSave);
    form.addEventListener('submit', handleSave);

    attachRehydrateListener(form, saveBtn);
}
