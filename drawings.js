(() => {
  const dialog = document.getElementById('elev-dialog');
  const img = document.getElementById('elev-dialog-img');
  const title = document.getElementById('elev-dialog-title');
  const close = document.getElementById('elev-close');
  if (!dialog || !img) return;
  document.querySelectorAll('.elevation-open').forEach((btn) => {
    btn.addEventListener('click', () => {
      img.classList.remove('zoomed');
      img.src = btn.dataset.src;
      img.alt = btn.dataset.title + ' at full size';
      title.textContent = btn.dataset.title;
      if (typeof dialog.showModal === 'function') dialog.showModal();
    });
  });
  img.addEventListener('click', () => img.classList.toggle('zoomed'));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
})();
