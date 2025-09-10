// per-panel modules (run only when their pane is shown)
import onProductTab from './panels/product.js';
import onColorTab from './panels/color.js';
import onSizeTab from './panels/size.js';
import onTextTab from './panels/text.js';
import onImageTab from './panels/image.js';

const panelHandlers = {
  'pane-product': onProductTab,
  'pane-color': onColorTab,
  'pane-size': onSizeTab,
  'pane-text': onTextTab,
  'pane-image': onImageTab,
};

document.addEventListener('DOMContentLoaded', () => {
  // fire handler for initially active tab
  const activePane = document.querySelector('#leftPanel .tab-pane.show.active');
  if (activePane) panelHandlers[activePane.id]?.(activePane);

  // when header tab changes, Bootstrap triggers shown.bs.tab on the button
  document.getElementById('headerTabs')?.addEventListener('shown.bs.tab', (e) => {
    const targetSelector = e.target.getAttribute('data-bs-target'); // like #pane-color
    const pane = document.querySelector(targetSelector);
    panelHandlers[pane.id]?.(pane);
  });
});
