document.querySelector('.nav-toggle')?.addEventListener('click', function () {
  document.querySelector('.nav-links')?.classList.toggle('open');
});
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    document.querySelector('.nav-links')?.classList.remove('open');
  });
});
