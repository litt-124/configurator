import {
    toggleDisabled,
    readStepData,
    writeStepData,
    openRelatedCollapsesForPrefill,
    showAlert,
} from '../utils.js';

const PANE_ID      = 'pane-fastening';
const NEXT_PANE_ID = 'pane-extension';

export default function onFasteningTab(paneEl) {
    const form    = paneEl.querySelector('#fasteningForm');
    const saveBtn = paneEl.querySelector('.js-save-button');

    if (!form || !saveBtn) return;

    const radioSelector  = '.js-fastening-input';
    const videoSelector  = '.js-fastening-video-trigger';

    // ---------- Save button initial state + rehydrate ----------
    const saved = readStepData(PANE_ID);
    if (saved?.fasteningInputId) {
        const prev = form.querySelector(`#${CSS.escape(saved.fasteningInputId)}`);
        if (prev) {
            prev.checked = true;
            openRelatedCollapsesForPrefill(prev);
        }
    }

    toggleDisabled(saveBtn, !form.querySelector(`${radioSelector}:checked`));

    // When user changes selection, enable save
    form.addEventListener('change', (e) => {
        const input = e.target.closest(radioSelector);
        if (!input) return;

        toggleDisabled(saveBtn, false);
    });

    // ---------- Save & go to next step ----------
    saveBtn.addEventListener('click', (e) => {
        e.preventDefault();

        const chosen = form.querySelector(`${radioSelector}:checked`);
        if (!chosen) {
            showAlert('danger');
            return;
        }

        const data = {
            fasteningInputId: chosen.id,
            value: chosen.value,
        };

        writeStepData(PANE_ID, data);

        const ev = new CustomEvent('configurator:step-complete', {
            detail: {
                stepId:    PANE_ID,
                nextStepId: NEXT_PANE_ID,
                data,
            },
        });
        document.dispatchEvent(ev);
        showAlert('success');
    });

    // ---------- Global rehydrate (when flow restores this tab later) ----------
    document.addEventListener('configurator:rehydrate', (ev) => {
        const { stepId, data } = ev.detail || {};
        if (stepId !== PANE_ID || !data?.fasteningInputId) return;

        const prev = form.querySelector(`#${CSS.escape(data.fasteningInputId)}`);
        if (prev) {
            prev.checked = true;
            openRelatedCollapsesForPrefill(prev);
        }

        toggleDisabled(saveBtn, !form.querySelector(`${radioSelector}:checked`));
    }, { once: true });

    // ---------- Video modal wiring ----------
    const modalEl   = document.getElementById('fasteningVideoModal');
    const titleEl   = modalEl?.querySelector('#fasteningVideoTitle');
    const videoEl   = modalEl?.querySelector('.js-fastening-video-player');
    const sourceEl  = videoEl?.querySelector('source');
    const ModalCtor = window.bootstrap?.Modal;
    const modal     = (modalEl && ModalCtor)
        ? ModalCtor.getOrCreateInstance(modalEl)
        : null;

    if (modalEl && videoEl && sourceEl && modal) {
        // click any trigger inside this pane
        paneEl.addEventListener('click', (e) => {
            const trigger = e.target.closest(videoSelector);
            if (!trigger) return;

            const src   = trigger.dataset.fasteningVideoSrc || '';
            const title = trigger.dataset.fasteningVideoTitle || '';

            if (!src) return;

            sourceEl.src = src;
            videoEl.load();

            if (titleEl) {
                titleEl.textContent = title;
            }

            modal.show();
        });

        modalEl.addEventListener('shown.bs.modal', () => {
            try {
                videoEl.play();
            } catch (_) {
            }
        });

        // pause & reset when closed
        modalEl.addEventListener('hidden.bs.modal', () => {
            try {
                videoEl.pause();
                videoEl.currentTime = 0;
            } catch (_) {
                // ignore
            }
            sourceEl.src = '';
            videoEl.load();
        });
    }
}
