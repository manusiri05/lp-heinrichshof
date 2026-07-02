/* Heinrichshof LP – shared behaviour */
(function () {
  // Header scroll state
  var header = document.getElementById('site-header');
  function onScroll() {
    if (window.scrollY > 40) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Fade-in on scroll
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.fade').forEach(function (el) { observer.observe(el); });

  // Accordion
  document.querySelectorAll('.acc-head').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.acc-item');
      var body = item.querySelector('.acc-body');
      var isOpen = item.classList.contains('open');
      if (isOpen) {
        body.style.maxHeight = null;
        item.classList.remove('open');
      } else {
        item.classList.add('open');
        body.style.maxHeight = body.scrollHeight + 'px';
      }
    });
  });
})();
