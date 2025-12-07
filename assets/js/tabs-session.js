// modules/tabs-session.js
import {
  getActiveTab, setActiveTab,
  getEnabledTabs, setEnabledTabs,
  readStepData, writeStepData,
} from './utils.js';

export function initTabsSession({
                                  tablistSelector = '#headerTabs',
                                } = {}) {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const tablist = $(tablistSelector);
  if (!tablist) return;

  const tabButtons = $$('.nav-link[data-bs-target]', tablist);
  const order = tabButtons.map(b => b.getAttribute('data-bs-target')?.slice(1)).filter(Boolean);
  if (!order.length) return;

  // Enabled list: default only first
  let enabled = getEnabledTabs(order);
  if (!enabled.length) enabled = [order[0]];
  if (!enabled.includes(order[0])) enabled.unshift(order[0]);
  enabled = [...new Set(enabled)].filter(id => order.includes(id));
  setEnabledTabs(enabled);

  // applyDisabledUI(tabButtons, enabled);

  // Active tab: restore or fall back to first enabled
  let active = getActiveTab();
  if (!active || !enabled.includes(active) || !order.includes(active)) {
    active = enabled[0];
  }
  showTab(tabButtons, active);
  setActiveTab(active);

  // Broadcast rehydrate for already-enabled steps (so panels can pre-fill UI)
  for (const stepId of enabled) {
    const data = readStepData(stepId);
    const ev = new CustomEvent('configurator:rehydrate', { detail: { stepId, data } });
    document.dispatchEvent(ev);
  }

  // Persist active on switch
  document.addEventListener('shown.bs.tab', (ev) => {
    const id = ev.target?.getAttribute('data-bs-target')?.slice(1);
    if (id) setActiveTab(id);
  });

  // Listen for step completion
  document.addEventListener('configurator:step-complete', (ev) => {
    const { stepId, data, nextStepId } = ev.detail || {};
    if (!stepId) return;

    if (data !== undefined) writeStepData(stepId, data);

    // find next
    let target = nextStepId;
    if (!target) {
      const i = order.indexOf(stepId);
      if (i >= 0 && i < order.length - 1) target = order[i + 1];
    }
    if (!target) return;

    if (!enabled.includes(target)) {
      enabled.push(target);
      setEnabledTabs(enabled);
      applyDisabledUI(tabButtons, enabled);
      // also broadcast rehydrate for the newly enabled step (if it has stored data)
      const nextData = readStepData(target);
      const ev2 = new CustomEvent('configurator:rehydrate', { detail: { stepId: target, data: nextData } });
      document.dispatchEvent(ev2);
    }

    showTab(tabButtons, target);
    setActiveTab(target);
  });
}

function applyDisabledUI(tabButtons, enabled) {
  const set = new Set(enabled);
  for (const btn of tabButtons) {
    const paneId = btn.getAttribute('data-bs-target').slice(1);
    const ok = set.has(paneId);
    btn.classList.toggle('disabled', !ok);
    btn.setAttribute('aria-disabled', String(!ok));
    if (!ok) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, { once: true });
    }
  }
}

function showTab(tabButtons, paneId) {
  const btn = tabButtons.find(b => b.getAttribute('data-bs-target') === `#${paneId}`);
  if (!btn) return;
  if (window.bootstrap?.Tab) {
    new bootstrap.Tab(btn).show();
  } else {
    // fallback
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('show', 'active'));
    document.querySelector(`#${paneId}`)?.classList.add('show', 'active');
  }
}
