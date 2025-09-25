export default function onImageTab(pane) {
  if (pane.dataset.inited === '1') return;
  pane.dataset.inited = '1';

  const ctas    = pane.querySelector('.js-image-ctas');
  const archive = pane.querySelector('.js-image-archive');
  const browse  = pane.querySelector('.js-browse-btn');

  if (!ctas || !archive || !browse) return;

  browse.addEventListener('click', () => {
    ctas.classList.add('d-none');
    archive.classList.remove('d-none');
  });
}
