
import onTextTab from './panels/text.js';
import onImageTab from './panels/image.js';
import { initBackground } from './background.js';   // ← add this
import onColorTab from './panels/color.js';   // ← add this

const panelHandlers = {
  'pane-text': onTextTab,
    'pane-image': onImageTab,
    'pane-color': onColorTab,     

};

document.addEventListener('DOMContentLoaded', () => {
    initBackground({ root: '#materialSelect', canvas: '#workCanvasContainer' });

  // fire handler for initially active tab
  console.log(99);
  const activePane = document.querySelector('#leftPanel .tab-pane.show.active');
  if (activePane) panelHandlers[activePane.id]?.(activePane);

  // when header tab changes, Bootstrap triggers shown.bs.tab on the button
  document.getElementById('headerTabs')?.addEventListener('shown.bs.tab', (e) => {
    const targetSelector = e.target.getAttribute('data-bs-target'); // like #pane-color
    const pane = document.querySelector(targetSelector);
    panelHandlers[pane.id]?.(pane);
  });
});


