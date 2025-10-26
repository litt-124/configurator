export function initBackground({ root = '#materialSelect', canvas = '#canvas' } = {}) {
  const rootEl = document.querySelector(root);
  const canvasEl = document.querySelector(canvas);
  if (!rootEl || !canvasEl) return;

  const current = rootEl.querySelector('.current');
  const list = rootEl.querySelector('.ms-list');

  const materials = [
    { id: 'white-plaster', label: 'White plaster', img: '/assets/img/materials/white-plaster.jpg' },
    { id: 'raw-concrete',  label: 'Raw concrete',  img: '/assets/img/materials/raw-concrete.jpg' },
    { id: 'beige-stucco',  label: 'Beige stucco',  img: '/assets/img/materials/beige-stucco.jpg' },
    { id: 'grey-stone',    label: 'Grey stone',    img: '/assets/img/materials/grey-stone.jpg' },
  ];

  const tile = (m) => `
    <div class="ms-thumb" style="background-image:url('${m.img}')"></div>
    <div class="ms-text">${m.label}</div>
  `;

  list.innerHTML = materials.map(m => `
    <li class="ms-option p-xs" role="option" data-id="${m.id}" aria-selected="false">
      ${tile(m)}
    </li>
  `).join('');

  select(materials[0].id, false);

  // toggle open
  current.addEventListener('click', () => {
    const open = rootEl.classList.toggle('is-open');
    list.toggleAttribute('hidden', !open);
  });

  // outside close
  document.addEventListener('click', (e) => {
    if (!rootEl.contains(e.target)) {
      rootEl.classList.remove('is-open');
      list.setAttribute('hidden', '');
    }
  });

  // choose
  list.addEventListener('click', (e) => {
    const li = e.target.closest('.ms-option');
    if (!li) return;
    select(li.dataset.id, true);
    rootEl.classList.remove('is-open');
    list.setAttribute('hidden', '');
  });

  function select(id, applyBg) {
    const m = materials.find(x => x.id === id);
    if (!m) return;

    [...list.children].forEach(li => li.setAttribute('aria-selected', String(li.dataset.id === id)));
    current.innerHTML = tile(m);

    if (applyBg !== false) {
      const im = new Image();
      im.onload = () => {
        canvasEl.style.backgroundImage = `url('${m.img}')`;
        canvasEl.style.backgroundPosition = 'center';
        canvasEl.style.backgroundSize = 'cover';
      };
      im.src = m.img;
    } else {
      canvasEl.style.backgroundImage = `url('${m.img}')`;
      canvasEl.style.backgroundPosition = 'center';
      canvasEl.style.backgroundSize = 'cover';
    }
  }

  return { selectById: (id) => select(id, true) };
}
