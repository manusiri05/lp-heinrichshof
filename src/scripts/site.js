(function () {
  document.documentElement.classList.add('js');
  document.documentElement.dataset.siteReady = 'true';

  var header = document.querySelector('[data-header]');
  function updateHeader() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  document.querySelectorAll('.info-list').forEach(function (list) {
    list.querySelectorAll('details').forEach(function (item) {
      item.addEventListener('toggle', function () {
        if (!item.open) return;
        list.querySelectorAll('details[open]').forEach(function (other) {
          if (other !== item) other.open = false;
        });
      });
    });
  });

  function connectSlider(sectionSelector, trackSelector, previousSelector, nextSelector) {
    document.querySelectorAll(sectionSelector).forEach(function (section) {
      var track = section.querySelector(trackSelector);
      var previous = section.querySelector(previousSelector);
      var next = section.querySelector(nextSelector);
      if (!track || !previous || !next) return;
      track.dataset.sliderReady = 'true';
      function move(direction) {
        var slides = Array.prototype.slice.call(track.children);
        if (!slides.length) return;
        var trackLeft = track.getBoundingClientRect().left;
        var positions = slides.map(function (slide) {
          return slide.getBoundingClientRect().left - trackLeft + track.scrollLeft;
        });
        var current = positions.reduce(function (nearest, position, index) {
          return Math.abs(position - track.scrollLeft) < Math.abs(positions[nearest] - track.scrollLeft) ? index : nearest;
        }, 0);
        var target = Math.max(0, Math.min(slides.length - 1, current + direction));
        track.scrollTo({ left: positions[target], behavior: 'smooth' });
      }
      previous.addEventListener('click', function () { move(-1); });
      next.addEventListener('click', function () { move(1); });
    });
  }
  connectSlider('.rooms', '[data-slider]', '[data-slider-prev]', '[data-slider-next]');
  connectSlider('.gallery', '[data-gallery-slider]', '[data-gallery-prev]', '[data-gallery-next]');

  var bookingSection = document.getElementById('buchung');
  if (bookingSection && 'IntersectionObserver' in window) {
    var bookingObserver = new IntersectionObserver(function (entries) {
      document.body.classList.toggle('booking-in-view', entries.some(function (entry) { return entry.isIntersecting; }));
    }, { threshold: 0.12 });
    bookingObserver.observe(bookingSection);
  }

  document.querySelectorAll('[data-offers-grid]').forEach(function (grid) {
    var today = new Date();
    today.setHours(12, 0, 0, 0);
    var visible = 0;
    grid.querySelectorAll('[data-offer-card]').forEach(function (card) {
      var from = new Date(card.dataset.displayFrom + 'T12:00:00');
      var until = new Date(card.dataset.displayUntil + 'T12:00:00');
      var active = today >= from && today <= until;
      card.hidden = !active;
      if (active) visible += 1;
    });
    var empty = grid.parentElement.querySelector('[data-offers-empty]');
    if (empty) empty.hidden = visible > 0;
  });

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach(function (element) { observer.observe(element); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (element) { element.classList.add('is-visible'); });
  }
})();
