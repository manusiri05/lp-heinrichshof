(function () {
  var form = document.querySelector('[data-voucher-form]');
  if (!form) return;

  var status = form.querySelector('[data-voucher-status]');
  var success = form.querySelector('[data-voucher-success]');
  var button = form.querySelector('button[type="submit"]');
  var tracked = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gad_source', 'gad_campaignid'];

  function savedAttribution() {
    var collected = {};
    ['guestflow_utm', 'heinrichshof_campaign_attribution'].forEach(function (key) {
      try { Object.assign(collected, JSON.parse(localStorage.getItem(key) || '{}')); } catch (_) {}
    });
    var params = new URLSearchParams(window.location.search);
    tracked.forEach(function (key) {
      if (params.get(key)) collected[key] = params.get(key);
    });
    return collected;
  }

  function setInvalid(field, invalid) {
    field.setAttribute('aria-invalid', invalid ? 'true' : 'false');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var required = Array.from(form.querySelectorAll('[required]'));
    var invalid = required.filter(function (field) {
      var empty = field.type === 'checkbox' ? !field.checked : !String(field.value || '').trim();
      setInvalid(field, empty);
      return empty;
    });
    var email = form.querySelector('[name="email"]');
    if (email && email.value && !/^\S+@\S+\.\S+$/.test(email.value)) {
      setInvalid(email, true);
      if (!invalid.includes(email)) invalid.push(email);
    }
    if (invalid.length) {
      status.textContent = 'Bitte prüfen Sie die markierten Pflichtfelder.';
      invalid[0].focus();
      return;
    }

    var data = new FormData(form);
    var attribution = savedAttribution();
    var payload = {
      hotel_slug: form.dataset.hotelSlug,
      campaign_id: form.dataset.campaignId,
      firstname: data.get('firstname'),
      lastname: data.get('lastname'),
      email: data.get('email'),
      utm_source: attribution.utm_source || '',
      utm_medium: attribution.utm_medium || '',
      utm_campaign: attribution.utm_campaign || ''
    };
    var originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Wird gesendet …';
    status.textContent = '';

    fetch(form.dataset.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error('request_failed');
      return response.json();
    }).then(function (result) {
      if (!result || !result.success) throw new Error('request_failed');
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'voucher_signup_success' });
      success.hidden = false;
      button.hidden = true;
      Array.from(form.querySelectorAll('input')).forEach(function (field) { field.disabled = true; });
    }).catch(function () {
      status.textContent = 'Das Senden hat gerade nicht funktioniert. Bitte versuchen Sie es erneut.';
      button.disabled = false;
      button.textContent = originalLabel;
    });
  });
})();
