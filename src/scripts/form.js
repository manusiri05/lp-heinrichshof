(function () {
  var STORAGE_KEY = 'heinrichshof_campaign_attribution';
  var params = new URLSearchParams(window.location.search);
  var tracked = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gad_source', 'gad_campaignid'];
  var attribution = {};
  tracked.forEach(function (key) { if (params.get(key)) attribution[key] = params.get(key); });
  if (Object.keys(attribution).length) {
    attribution.capturedAt = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution)); } catch (_) {}
  }

  function savedAttribution() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) { return {}; }
  }

  document.querySelectorAll('[data-lead-form]').forEach(function (form) {
    var language = (form.dataset.language || 'DE').toLowerCase();
    var messages = {
      de: { childAge: 'Alter Kind', invalid: 'Bitte prüfen Sie die markierten Pflichtfelder.', campaign: 'Kampagne', board: 'Verpflegung', sending: 'Wird gesendet …', success: 'Vielen Dank! Ihre Anfrage wurde erfolgreich gesendet.', error: 'Das Senden hat gerade nicht funktioniert. Bitte versuchen Sie es erneut oder rufen Sie uns an.' },
      en: { childAge: 'Age of child', invalid: 'Please check the highlighted required fields.', campaign: 'Campaign', board: 'Board', sending: 'Sending …', success: 'Thank you! Your enquiry has been sent successfully.', error: 'Your enquiry could not be sent just now. Please try again or call us.' },
      it: { childAge: 'Età bambino', invalid: 'Controlli i campi obbligatori evidenziati.', campaign: 'Campagna', board: 'Trattamento', sending: 'Invio in corso …', success: 'Grazie! La sua richiesta è stata inviata correttamente.', error: 'Al momento non è stato possibile inviare la richiesta. Riprovi oppure ci chiami.' },
      nl: { childAge: 'Leeftijd kind', invalid: 'Controleer de gemarkeerde verplichte velden.', campaign: 'Campagne', board: 'Verzorging', sending: 'Wordt verzonden …', success: 'Hartelijk dank! Uw aanvraag is succesvol verzonden.', error: 'De aanvraag kon zojuist niet worden verzonden. Probeer het opnieuw of bel ons.' }
    }[language] || null;
    messages = messages || { childAge: 'Age of child', invalid: 'Please check the highlighted required fields.', campaign: 'Campaign', board: 'Board', sending: 'Sending …', success: 'Thank you! Your enquiry has been sent successfully.', error: 'Your enquiry could not be sent just now. Please try again or call us.' };
    var status = form.querySelector('[data-form-status]');
    var checkin = form.querySelector('[name="checkin"]');
    var checkout = form.querySelector('[name="checkout"]');
    var children = form.querySelector('[name="children"]');
    var ages = form.querySelector('[data-child-ages]');
    var today = new Date();
    var todayIso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    checkin.min = todayIso;
    checkout.min = todayIso;

    function updateCheckout() {
      if (!checkin.value) return;
      var next = new Date(checkin.value + 'T12:00:00');
      next.setDate(next.getDate() + 1);
      var minimum = next.toISOString().slice(0, 10);
      checkout.min = minimum;
      if (!checkout.value || checkout.value < minimum) checkout.value = minimum;
    }
    checkin.addEventListener('change', updateCheckout);

    function updateAges() {
      var count = Number(children.value || 0);
      ages.replaceChildren();
      ages.hidden = count === 0;
      for (var index = 1; index <= count; index += 1) {
        var field = document.createElement('div');
        field.className = 'field';
        var label = document.createElement('label');
        label.htmlFor = 'child-age-' + form.dataset.page.replace(/\W/g, '') + '-' + index;
        label.textContent = messages.childAge + ' ' + index + ' *';
        var input = document.createElement('input');
        input.id = label.htmlFor;
        input.name = 'child_age_' + index;
        input.type = 'number';
        input.min = '0';
        input.max = '17';
        input.inputMode = 'numeric';
        input.required = true;
        field.append(label, input);
        ages.append(field);
      }
    }
    children.addEventListener('change', updateAges);
    updateAges();

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var invalid = Array.from(form.querySelectorAll('[required]')).filter(function (field) {
        var bad = field.type === 'checkbox' ? !field.checked : !String(field.value || '').trim();
        field.setAttribute('aria-invalid', bad ? 'true' : 'false');
        return bad;
      });
      var email = form.querySelector('[name="email"]');
      if (email && email.value && !/^\S+@\S+\.\S+$/.test(email.value)) {
        email.setAttribute('aria-invalid', 'true');
        if (!invalid.includes(email)) invalid.push(email);
      }
      if (checkin.value && checkout.value && checkout.value <= checkin.value) {
        checkout.setAttribute('aria-invalid', 'true');
        if (!invalid.includes(checkout)) invalid.push(checkout);
      }
      if (invalid.length) {
        status.textContent = messages.invalid;
        invalid[0].focus();
        return;
      }

      var button = form.querySelector('button[type="submit"]');
      var data = new FormData(form);
      var attributionData = savedAttribution();
      var childAges = Array.from(form.querySelectorAll('[name^="child_age_"]')).map(function (field) { return field.value; });
      var messageParts = [];
      if (form.dataset.campaign) messageParts.push(messages.campaign + ': ' + form.dataset.campaign);
      if (data.get('board')) messageParts.push(messages.board + ': ' + data.get('board'));
      if (data.get('message')) messageParts.push(data.get('message'));
      var payload = {
        hotel_slug: form.dataset.hotelSlug,
        firstname: data.get('firstname'),
        lastname: data.get('lastname'),
        email: data.get('email'),
        phone: data.get('phone'),
        checkin: data.get('checkin'),
        checkout: data.get('checkout'),
        adults: Number(data.get('adults') || 2),
        children: Number(data.get('children') || 0),
        children_ages: childAges.join(', '),
        message: messageParts.join('\n'),
        room_type: data.get('room_type') || '',
        language: form.dataset.language || 'DE',
        landing_page: form.dataset.page || window.location.pathname,
        utm_source: attributionData.utm_source || '',
        utm_medium: attributionData.utm_medium || '',
        utm_campaign: attributionData.utm_campaign || '',
        utm_term: attributionData.utm_term || '',
        utm_content: attributionData.utm_content || '',
        gclid: attributionData.gclid || '',
        gad_source: attributionData.gad_source || '',
        gad_campaignid: attributionData.gad_campaignid || ''
      };

      var originalButtonLabel = button.textContent;
      button.disabled = true;
      button.textContent = messages.sending;
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
        window.dataLayer.push({
          event: 'form_lead_success',
          form_data: {
            room: payload.room_type,
            guests: payload.adults,
            lead_id: result.id,
            landing_page: payload.landing_page
          }
        });
        status.style.color = '#456a46';
        status.textContent = messages.success;
        button.hidden = true;
        form.reset();
        updateAges();
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      }).catch(function () {
        status.textContent = messages.error;
        button.disabled = false;
        button.textContent = originalButtonLabel;
      });
    });
  });
})();
