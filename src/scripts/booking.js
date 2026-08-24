(function () {
  var containers = document.querySelectorAll('[data-booking-widget]');
  if (!containers.length) return;

  var loading;
  function loadLibrary() {
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      if (window['BookingSüdtirol']) return resolve(window['BookingSüdtirol']);
      var script = document.createElement('script');
      script.src = 'https://widget.bookingsuedtirol.com/v2/bundle.js';
      script.async = true;
      script.onload = function () { resolve(window['BookingSüdtirol']); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return loading;
  }

  function initialise(container) {
    if (container.dataset.initialised) return;
    container.dataset.initialised = 'true';
    loadLibrary().then(function (booking) {
      if (!booking || !booking.Widgets) throw new Error('widget_unavailable');
      container.replaceChildren();
      booking.Widgets.Booking('#' + container.id, {
        id: container.dataset.widgetId,
        propertyId: Number(container.dataset.propertyId),
        lang: container.dataset.language || 'de',
        privacyURL: container.dataset.privacyUrl,
        termsURL: container.dataset.termsUrl,
        onEnquirySuccess: function (reservation) {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event: 'form_lead_success', form_data: { source: 'booking_widget', landing_page: window.location.pathname, reservation_id: reservation && reservation.id } });
        },
        onBookingSuccess: function (reservation) {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event: 'booking_success', booking_data: { landing_page: window.location.pathname, reservation_id: reservation && reservation.id } });
        }
      });
    }).catch(function () {
      var fallback = {
        de: 'Die Online-Buchung konnte gerade nicht geladen werden. Bitte nutzen Sie die Anfrage oder rufen Sie uns an.',
        en: 'Online booking could not be loaded just now. Please use the enquiry form or call us.',
        it: 'Al momento non è stato possibile caricare la prenotazione online. Utilizzi il modulo di richiesta oppure ci chiami.',
        nl: 'Online boeken kon zojuist niet worden geladen. Gebruik het aanvraagformulier of bel ons.'
      }[container.dataset.language] || 'Online booking could not be loaded just now. Please use the enquiry form or call us.';
      container.innerHTML = '<p class="widget-fallback">' + fallback + '</p>';
    });
  }

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          initialise(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '500px 0px' });
    containers.forEach(function (container) { observer.observe(container); });
  } else {
    containers.forEach(initialise);
  }
})();
