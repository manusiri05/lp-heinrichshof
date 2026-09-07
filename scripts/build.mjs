import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src');
const output = path.join(root, 'dist');
const optimisedAssets = path.join(source, 'images');
const curatedAssets = path.join(source, 'source-images');
const incomingAssets = path.resolve(root, '..', 'assets');
const legacyAssets = path.resolve(root, '..', 'lp-alt', 'assets');

const readJson = async (name) => JSON.parse(await readFile(path.join(source, 'data', name), 'utf8'));
const [config, site, pages, seasons, offers, content, locales] = await Promise.all([
  readJson('config.json'), readJson('site.json'), readJson('pages.json'), readJson('seasons.json'), readJson('offers.json'), readJson('content.json'), readJson('locales.json')
]);
const assetVersion = createHash('sha1').update((await Promise.all([
  readFile(path.join(source, 'styles', 'site.css'), 'utf8'),
  readFile(path.join(source, 'scripts', 'site.js'), 'utf8'),
  readFile(path.join(source, 'scripts', 'form.js'), 'utf8'),
  readFile(path.join(source, 'scripts', 'voucher.js'), 'utf8'),
  readFile(path.join(source, 'scripts', 'booking.js'), 'utf8')
])).join('')).digest('hex').slice(0, 10);
const buildDate = config.dateOverride || new Date().toISOString().slice(0, 10);

function resolveSeason(date) {
  if (config.seasonMode !== 'auto' || !config.seasonStarts) return config.activeSeason;
  const monthDay = date.slice(5);
  const starts = Object.entries(config.seasonStarts).sort((left, right) => left[1].localeCompare(right[1]));
  let active = starts.at(-1)?.[0] || config.activeSeason;
  for (const [season, start] of starts) if (monthDay >= start) active = season;
  return active;
}

const activeSeason = resolveSeason(buildDate);

const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const dateLabel = (value, locale = 'de-DE') => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
const seasonNames = { fruehling: 'Frühling', sommer: 'Sommer', herbst: 'Herbst' };
const isRelevantOffer = (offer, page, season) => {
  const audience = page.offerAudience || page.key;
  const audienceMatches = offer.audiences.includes('all') || offer.audiences.includes(audience);
  return offer.enabled && audienceMatches && offer.seasons.includes(season);
};
const optimisedName = (name, width) => `${path.parse(name).name}-${width}.webp`;
const isExternalImage = (name) => /^https?:\/\//i.test(name);
const hasOptimised = (name, width) => !isExternalImage(name) && existsSync(path.join(optimisedAssets, optimisedName(name, width)));
const imageAttributes = (name, sizes = '100vw') => {
  if (isExternalImage(name)) return `src="${esc(name)}" referrerpolicy="no-referrer"`;
  if (hasOptimised(name, 720) && hasOptimised(name, 1440)) {
    return `src="/assets/images/${esc(optimisedName(name, 1440))}" srcset="/assets/images/${esc(optimisedName(name, 720))} 720w, /assets/images/${esc(optimisedName(name, 1440))} 1440w" sizes="${esc(sizes)}"`;
  }
  return `src="/assets/images/${esc(name)}"`;
};
const heroPicture = (name, alt) => `<picture class="hero-media">${hasOptimised(name, 720) && hasOptimised(name, 1440) ? `<source media="(max-width: 720px)" srcset="/assets/images/${esc(optimisedName(name, 720))}">` : ''}<img ${imageAttributes(name)} alt="${esc(alt)}" width="1440" height="960" fetchpriority="high"></picture>`;

function highlights(items = [], t) {
  if (!items.length) return '';
  return `<section class="section highlights"><div class="container"><div class="section-heading reveal"><p class="eyebrow">${esc(t.highlightsEyebrow)}</p><h2 class="display">${esc(t.highlightsTitle)}</h2></div><div class="highlight-grid">${items.map((item) => `
    <article class="highlight reveal"><img ${imageAttributes(item.image, '(max-width: 820px) 100vw, 33vw')} alt="${esc(item.title)}" width="900" height="720" loading="lazy"><div class="highlight-body"><p class="eyebrow">${esc(item.eyebrow)}</p><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></div></article>`).join('')}</div></div></section>`;
}

function story(block, t) {
  if (!block) return '';
  return `<section class="section story"><div class="container story-grid"><div class="reveal"><p class="eyebrow">${esc(block.eyebrow)}</p><h2 class="display">${esc(block.title)}</h2></div><div class="story-copy reveal">${block.text.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}<a class="button" href="#anfrage">${esc(t.storyCta)}</a></div></div></section>`;
}

function contentBlocks(blocks = []) {
  return blocks.map((block) => {
    if (block.heading) return `<h4>${esc(block.heading)}</h4>`;
    if (block.items) return `<ul>${block.items.map((item) => typeof item === 'string'
      ? `<li>${esc(item)}</li>`
      : `<li><strong>${esc(item.label)}:</strong> ${esc(item.text)}</li>`).join('')}</ul>`;
    if (block.label) return `<p><strong>${esc(block.label)}:</strong> ${esc(block.text)}</p>`;
    return `<p>${esc(block.text)}</p>`;
  }).join('');
}

function informationBlock(profileKey, locale) {
  const information = locale.information?.[profileKey] || locale.information?.hotel || content.information[profileKey] || content.information.hotel;
  if (!information?.sections?.length) return '';
  return `<section class="section information"><div class="container info-wrap"><div class="section-heading reveal"><p class="eyebrow">${esc(information.eyebrow)}</p><h2 class="display">${esc(information.title)}</h2></div><div class="info-list reveal">${information.sections.map((section) => `
    <details class="info-item"><summary><span>${esc(section.title)}</span><span class="info-plus" aria-hidden="true"></span></summary><div class="info-panel">${contentBlocks(section.blocks)}</div></details>`).join('')}</div></div></section>`;
}

function expectationsBlock(profileKey, seasonKey) {
  const block = content.expectations[profileKey];
  if (!block) return '';
  const title = block.title.replace('{season}', seasonNames[seasonKey] || seasonKey);
  return `<section class="section expectations"><div class="container"><div class="expectations-head reveal"><p class="eyebrow">${esc(block.eyebrow)}</p><h2 class="display">${esc(title)}</h2><p class="lead">${esc(block.intro)}</p></div><div class="expectation-grid${block.columns.length === 1 ? ' expectation-grid--single' : ''}">${block.columns.map((column) => `
    <article class="expectation-card reveal"><p class="eyebrow">${esc(column.title)}</p><ul>${column.items.map((item) => `<li class="${column.tone === 'negative' ? 'is-negative' : 'is-positive'}">${esc(item)}</li>`).join('')}</ul></article>`).join('')}</div><div class="center-cta reveal"><a class="button" href="#anfrage">${esc(seasonNames[seasonKey] || '')}sauszeit anfragen</a></div></div></section>`;
}

function roomsBlock(profileKey, locale, t, enquiryHref = '#anfrage') {
  const key = profileKey === 'apartment' ? 'apartment' : 'hotel';
  const rooms = locale.rooms?.[key] || content.rooms[key];
  if (!rooms?.items?.length) return '';
  const isApartment = key === 'apartment';
  return `<section class="section rooms" id="zimmer"><div class="container"><div class="slider-head reveal"><div><p class="eyebrow">${esc(rooms.eyebrow)}</p><h2 class="display">${esc(rooms.title)}</h2><p class="lead">${esc(rooms.intro)}</p></div>${rooms.items.length > 1 ? `<div class="slider-controls"><button type="button" data-slider-prev aria-label="${esc(t.roomPrevious)}">←</button><button type="button" data-slider-next aria-label="${esc(t.roomNext)}">→</button></div>` : ''}</div><div class="room-track${isApartment ? ' room-track--single' : ''}" data-slider>${rooms.items.map((room) => `
    <article class="room-card reveal"><img ${imageAttributes(room.image, isApartment ? '(max-width: 820px) 100vw, 55vw' : '(max-width: 820px) 88vw, 34vw')} alt="${esc(room.title)}" width="1200" height="850" loading="lazy"><div class="room-body"><div class="room-meta">${esc(room.meta)}</div><h3>${esc(room.title)}</h3>${room.description ? `<p>${esc(room.description)}</p>` : ''}${room.details?.length ? `<ul class="room-details">${room.details.map((detail) => `<li>${esc(detail)}</li>`).join('')}</ul>` : ''}<div class="room-bottom"><strong>${esc(room.price)}</strong><div class="room-links">${room.url ? `<a href="${esc(room.url)}" target="_blank" rel="noopener">${esc(t.roomDetails)}</a>` : ''}<a href="${esc(enquiryHref)}">${esc(t.request)}</a></div></div></div></article>`).join('')}</div></div></section>`;
}

function galleryBlock(profileKey, locale, t) {
  const gallery = locale.galleries?.[profileKey] || locale.galleries?.hotel || content.galleries[profileKey] || content.galleries.hotel;
  if (!gallery?.items?.length) return '';
  return `<section class="section gallery"><div class="container"><div class="slider-head reveal"><div><p class="eyebrow">${esc(gallery.eyebrow)}</p><h2 class="display">${esc(gallery.title)}</h2></div><div class="slider-controls gallery-controls"><button type="button" data-gallery-prev aria-label="${esc(t.galleryPrevious)}">←</button><button type="button" data-gallery-next aria-label="${esc(t.galleryNext)}">→</button></div></div><div class="gallery-track" data-gallery-slider>${gallery.items.map((item, index) => `<figure class="gallery-item${index === 0 ? ' gallery-item--wide' : ''}"><img ${imageAttributes(item.image, '(max-width: 820px) 88vw, 25vw')} alt="${esc(item.alt)}" width="1200" height="900" loading="lazy"></figure>`).join('')}</div><p class="swipe-note">${esc(t.gallerySwipe)}</p></div></section>`;
}

function offerCards(page, season, locale, t) {
  const relevant = offers.filter((offer) => isRelevantOffer(offer, page, season));
  if (!relevant.length) return `<p class="lead">${esc(t.noOffers)}</p>`;
  const visibleCount = relevant.filter((offer) => buildDate >= offer.displayFrom && buildDate <= offer.displayUntil).length;
  return `<div class="offers-grid" data-offers-grid>${relevant.map((offer) => {
    const translated = locale.offers?.[offer.id] || {};
    const item = { ...offer, ...translated };
    return `
    <article class="offer reveal" data-offer-card data-display-from="${esc(offer.displayFrom)}" data-display-until="${esc(offer.displayUntil)}"${buildDate >= offer.displayFrom && buildDate <= offer.displayUntil ? '' : ' hidden'}>
      <img ${imageAttributes(offer.image, '(max-width: 820px) 100vw, 50vw')} alt="${esc(item.title)}" width="1200" height="750" loading="lazy">
      <div class="offer-body">
        <div class="offer-meta">${dateLabel(offer.stayFrom, locale.dateLocale)} – ${dateLabel(offer.stayTo, locale.dateLocale)} · ${esc(t.from)} ${offer.minNights} ${esc(t.nights)}</div>
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.summary)}</p>
        ${item.details?.length ? `<details class="offer-details"><summary>${esc(t.offerDetails)}</summary><ul>${item.details.map((detail) => `<li>${esc(detail)}</li>`).join('')}</ul></details>` : ''}
        <div class="offer-bottom"><span class="offer-price">${esc(item.price)}</span><a href="#anfrage">${esc(t.offerRequest)}</a></div>
      </div>
    </article>`;
  }).join('')}</div><p class="lead offers-empty" data-offers-empty${visibleCount ? ' hidden' : ''}>${esc(t.noOffers)}</p>`;
}

function voucherSignupBlock(locale) {
  return `<section class="section voucher-signup" id="voucher-anmeldung"><div class="container"><div class="voucher-signup-card reveal">
    <div class="voucher-signup-head"><p class="eyebrow">Der Heinrichshof · Algund</p><h2 class="display">Ihr € 50,- Kennenlern-Geschenk für den nächsten Urlaub</h2><p>Tragen Sie sich ein und Sie erhalten Ihren persönlichen Gutschein nach kurzer E-Mail-Bestätigung direkt als PDF.</p><span class="voucher-signup-rule" aria-hidden="true"></span></div>
    <form class="voucher-signup-form" data-voucher-form data-endpoint="https://dashboard.outofthebox-media.com/api/voucher/subscribe" data-hotel-slug="hotel-heinrichshof" data-campaign-id="8f67049d-8500-486a-af34-1264d11b2381" novalidate>
      <div class="field"><label for="voucher-firstname">Vorname *</label><input id="voucher-firstname" name="firstname" type="text" autocomplete="given-name" required></div>
      <div class="field"><label for="voucher-lastname">Nachname *</label><input id="voucher-lastname" name="lastname" type="text" autocomplete="family-name" required></div>
      <div class="field field--full"><label for="voucher-email">E-Mail *</label><input id="voucher-email" name="email" type="email" inputmode="email" autocomplete="email" required></div>
      <label class="voucher-privacy"><input name="privacy" type="checkbox" required><span>Ich habe die <a href="${esc(locale.links.privacy)}" target="_blank" rel="noopener">Datenschutzbestimmungen</a> gelesen und stimme der Verarbeitung meiner Daten zur Gutschein-Anmeldung zu. *</span></label>
      <p class="voucher-form-status" data-voucher-status role="status" aria-live="polite"></p>
      <p class="voucher-success" data-voucher-success role="status" aria-live="polite" hidden>✓ Vielen Dank! Bitte prüfen Sie Ihr E-Mail-Postfach (auch den Spam-Ordner) und bestätigen Sie Ihre Anmeldung. Danach erhalten Sie Ihren Gutschein direkt als PDF.</p>
      <button class="button voucher-submit" type="submit">Jetzt anmelden</button>
    </form>
  </div></div></section>`;
}

function winterBlock(page) {
  if (!page.winter) return '';
  return `<section class="section winter"><div class="container winter-card reveal"><div class="winter-media"><img ${imageAttributes(page.winter.image, '(max-width: 820px) 100vw, 50vw')} alt="${esc(page.winter.title)}" width="1200" height="900" loading="lazy"></div><div class="winter-copy"><p class="eyebrow">${esc(page.winter.eyebrow)}</p><h2 class="display">${esc(page.winter.title)}</h2>${page.winter.text.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}<ul>${page.winter.highlights.map((item) => `<li>${esc(item)}</li>`).join('')}</ul><a class="button" href="#anfrage">Winterzauber anfragen</a></div></div></section>`;
}

function form(page, localeKey, locale, t) {
  const labels = t.form;
  return `<form class="form-card" data-lead-form data-endpoint="${esc(site.apiUrl)}" data-hotel-slug="${esc(site.hotelSlug)}" data-language="${esc(localeKey.toUpperCase())}" data-page="${esc(page.route)}" data-pets-singular="${esc(labels.dogSingular)}" data-pets-plural="${esc(labels.dogPlural)}"${page.campaign ? ` data-campaign="${esc(page.campaign)}"` : ''} novalidate>
    <div class="form-grid">
      <div class="field"><label for="checkin-${page.key}">${esc(labels.arrival)} *</label><input id="checkin-${page.key}" name="checkin" type="date" required></div>
      <div class="field"><label for="checkout-${page.key}">${esc(labels.departure)} *</label><input id="checkout-${page.key}" name="checkout" type="date" required></div>
      <div class="field"><label for="firstname-${page.key}">${esc(labels.firstName)} *</label><input id="firstname-${page.key}" name="firstname" autocomplete="given-name" required></div>
      <div class="field"><label for="lastname-${page.key}">${esc(labels.lastName)} *</label><input id="lastname-${page.key}" name="lastname" autocomplete="family-name" required></div>
      <div class="field field--full"><label for="email-${page.key}">${esc(labels.email)} *</label><input id="email-${page.key}" name="email" type="email" inputmode="email" autocomplete="email" required></div>
      <div class="field field--full"><label for="phone-${page.key}">${esc(labels.phone)} *</label><input id="phone-${page.key}" name="phone" type="tel" inputmode="tel" autocomplete="tel" required></div>
      <div class="field"><label for="adults-${page.key}">${esc(labels.adults)}</label><select id="adults-${page.key}" name="adults"><option>1</option><option selected>2</option><option>3</option><option>4</option><option>5</option><option>6</option></select></div>
      <div class="field"><label for="children-${page.key}">${esc(labels.children)}</label><select id="children-${page.key}" name="children"><option selected>0</option><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
      <div class="field"><label for="pets-${page.key}">${esc(labels.dog)}</label><select id="pets-${page.key}" name="pets_choice" data-pets-choice><option value="no" selected>${esc(labels.dogNo)}</option><option value="yes">${esc(labels.dogYes)}</option></select></div>
      <div class="field" data-pets-count hidden><label for="pets-count-${page.key}">${esc(labels.dogCount)}</label><input id="pets-count-${page.key}" name="pets_count" type="number" min="1" max="3" step="1" value="1" inputmode="numeric" disabled></div>
      <div class="child-ages field--full" data-child-ages hidden></div>
      <div class="field field--full"><label for="board-${page.key}">${esc(labels.board)} *</label><select id="board-${page.key}" name="board" required><option value="">${esc(labels.boardPlaceholder)}</option><option>${esc(labels.breakfast)}</option><option>${esc(labels.halfBoard)}</option><option>${esc(labels.noBoard)}</option></select></div>
      <div class="field field--full"><label for="room-${page.key}">${esc(labels.room)}</label><select id="room-${page.key}" name="room_type"><option value="">${esc(labels.roomOpen)}</option><option>${esc(labels.doubleRoom)}</option><option>${esc(labels.suite)}</option><option>${esc(labels.apartment)}</option></select></div>
      <div class="field field--full"><label for="message-${page.key}">${esc(labels.message)}</label><textarea id="message-${page.key}" name="message"></textarea></div>
      <label class="privacy"><input name="privacy" type="checkbox" required><span>${esc(labels.privacyBefore)} <a href="${esc(locale.links.privacy)}" target="_blank" rel="noopener">${esc(labels.privacyLink)}</a> ${esc(labels.privacyAfter)} *</span></label>
      <p class="form-status" data-form-status role="status" aria-live="polite"></p>
      <button class="button submit" type="submit">${esc(labels.submit)}</button>
    </div>
  </form>`;
}

function render(page) {
  const localeKey = page.locale || page.lang.split('-')[0];
  const locale = locales[localeKey] || locales.de;
  const t = locale.ui;
  const seasonKey = page.fixedSeason || activeSeason;
  const season = locale.seasons?.[seasonKey] || seasons[seasonKey];
  const isVoucherPage = Boolean(page.voucher);
  const enquiryHref = isVoucherPage ? '#voucher-anmeldung' : '#anfrage';
  const headerSecondaryHref = isVoucherPage ? '#zimmer' : '#buchung';
  const headerSecondaryLabel = isVoucherPage ? 'Zimmer & Suiten' : t.book;
  const primaryCta = isVoucherPage ? 'Jetzt anmelden' : t.requestNonBinding;
  const heroSecondaryHref = isVoucherPage ? '#zimmer' : '#angebote';
  const heroSecondaryLabel = isVoucherPage ? 'Zimmer & Suiten entdecken' : t.discoverOffers;
  const seasonal = page.seasonal?.[seasonKey] || {};
  const hero = {
    ...page.hero,
    image: seasonal.heroImage || page.hero.image,
    eyebrow: seasonal.heroEyebrow || page.hero.eyebrow,
    title: seasonal.heroTitle || page.hero.title,
    subtitle: seasonal.heroSubtitle || page.hero.subtitle
  };
  const profileKey = page.contentProfile || (page.key === 'ferienwohnung' ? 'apartment' : page.key === 'urlaub-mit-hund' ? 'dog' : 'hotel');
  const robots = config.noindex ? 'noindex, nofollow' : 'index, follow';
  return `<!doctype html>
<html lang="${esc(page.lang)}">
<head>
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-KCNBCS8T');</script>
  <!-- End Google Tag Manager -->
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.description)}">
  <meta name="robots" content="${robots}">
  <meta name="theme-color" content="#282722">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/site.css?v=${assetVersion}">
  <script>document.documentElement.classList.add('js')</script>
</head>
<body>
  <!-- Google Tag Manager (noscript) -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KCNBCS8T"
  height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  <!-- End Google Tag Manager (noscript) -->
  <header class="site-header" data-header><div class="container header-inner">
    <a class="brand" href="#start" aria-label="${esc(site.name)} – ${esc(locale.descriptor || site.descriptor)}"><img src="/assets/logo.png" alt="${esc(site.name)}" width="244" height="64"></a>
    <div class="header-actions"><a class="button button--header-secondary header-book" href="${esc(headerSecondaryHref)}">${esc(headerSecondaryLabel)}</a><a class="button" href="${esc(enquiryHref)}">${esc(isVoucherPage ? 'Jetzt anmelden' : t.request)}</a></div>
  </div></header>

  <main>
    <section class="hero" id="start">
      ${heroPicture(hero.image, hero.eyebrow)}<div class="hero-shade"></div>
      <div class="container hero-content"><p class="eyebrow">${esc(hero.eyebrow)}</p><h1 class="display">${esc(hero.title)}</h1><p>${esc(hero.subtitle)}</p><div class="hero-buttons"><a class="button" href="${esc(enquiryHref)}">${esc(primaryCta)}</a><a class="button button--ghost" href="${esc(heroSecondaryHref)}">${esc(heroSecondaryLabel)}</a></div></div>
    </section>
    ${isVoucherPage ? '' : `<section class="trust"><div class="container trust-inner"><div class="trust-item"><strong>${esc(t.trustOneTitle)}</strong><span>${esc(t.trustOneText)}</span></div><div class="trust-item"><strong>${esc(t.trustTwoTitle)}</strong><span>${esc(t.trustTwoText)}</span></div><div class="trust-item"><strong>${esc(t.trustThreeTitle)}</strong><span>${esc(t.trustThreeText)}</span></div></div></section>`}

    ${isVoucherPage ? voucherSignupBlock(locale) : ''}

    ${isVoucherPage ? '' : `<section class="section"><div class="container intro-grid"><div class="photo reveal"><img ${imageAttributes(page.intro.image, '(max-width: 820px) 100vw, 52vw')} alt="${esc(page.intro.title)}" width="960" height="1200" loading="lazy"></div><div class="copy reveal"><p class="eyebrow">${esc(page.intro.eyebrow)}</p><h2 class="display">${esc(page.intro.title)}</h2>${page.intro.text.map((p) => `<p>${esc(p)}</p>`).join('')}<a href="#anfrage">${esc(t.personalOffer)}</a></div></div></section>`}

    ${isVoucherPage ? '' : highlights(page.highlights, t)}

    ${isVoucherPage ? '' : expectationsBlock(profileKey, seasonKey)}

    ${isVoucherPage ? '' : `<section class="section season"><div class="container"><article class="season-card reveal"><img ${imageAttributes(season.image, '(max-width: 820px) 100vw, 50vw')} alt="${esc(season.label)}" width="1200" height="900" loading="lazy"><div class="season-copy"><p class="eyebrow">${esc(season.label)}</p><h2 class="display">${esc(season.title)}</h2><p class="lead">${esc(season.text)}</p><a href="#angebote">${esc(t.seasonOffers)}</a></div></article></div></section>`}

    ${isVoucherPage ? '' : informationBlock(profileKey, locale)}

    ${roomsBlock(profileKey, locale, t, enquiryHref)}

    ${isVoucherPage ? '' : `<section class="section" id="angebote"><div class="container"><div class="offers-head"><div><p class="eyebrow">${esc(t.offersEyebrow)}</p><h2 class="display">${esc(t.offersTitle)}</h2></div><p class="lead">${esc(t.offersLead)}</p></div>${offerCards(page, seasonKey, locale, t)}</div></section>`}

    ${isVoucherPage ? '' : winterBlock(page)}

    ${galleryBlock(profileKey, locale, t)}

    ${isVoucherPage ? '' : story(page.story, t)}

    ${isVoucherPage ? '' : `<section class="section request" id="anfrage"><div class="container request-grid"><div><p class="eyebrow">${esc(t.requestEyebrow)}</p><h2 class="display">${esc(t.requestTitle)}</h2><p class="lead">${esc(t.requestLead)}</p></div>${form(page, localeKey, locale, t)}</div></section>
    <section class="section booking" id="buchung"><div class="container"><div class="booking-head"><p class="eyebrow">${esc(t.bookingEyebrow)}</p><h2 class="display">${esc(t.bookingTitle)}</h2></div><div class="booking-shell"><div id="booking-${esc(page.key)}" data-booking-widget data-widget-id="${esc(site.bookingWidgetId)}" data-property-id="${esc(site.bookingPropertyId)}" data-language="${esc(localeKey)}" data-privacy-url="${esc(locale.links.privacy)}" data-terms-url="https://www.heinrichshof.com/${esc(localeKey)}/"><p>${esc(t.bookingLoading)}</p></div></div></div></section>`}
  </main>

  <footer class="site-footer"><div class="container"><div class="footer-grid"><div><div class="footer-brand">${esc(site.name)}</div><div>${esc(site.address)}<br><a href="mailto:${esc(site.email)}">${esc(site.email)}</a> · <a href="tel:${esc(site.phoneHref)}">${esc(site.phoneLabel)}</a></div></div><nav class="footer-links" aria-label="Legal"><a href="${esc(locale.links.cookies)}">${esc(t.cookies)}</a><a href="${esc(locale.links.privacy)}">${esc(t.privacy)}</a><a href="${esc(locale.links.imprint)}">${esc(t.imprint)}</a></nav></div><div class="copyright">© ${new Date().getFullYear()} Hotel & Residence Der Heinrichshof · IT02295790212 · CIN: IT021038A142ZN5WEO</div></div></footer>
  <script src="/assets/site.js?v=${assetVersion}" defer></script><script src="/assets/form.js?v=${assetVersion}" defer></script><script src="/assets/voucher.js?v=${assetVersion}" defer></script><script src="/assets/booking.js?v=${assetVersion}" defer></script>
</body></html>`;
}

await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'assets', 'images'), { recursive: true });
await Promise.all([
  cp(path.join(source, 'styles', 'site.css'), path.join(output, 'assets', 'site.css')),
  cp(path.join(source, 'static', 'logo.png'), path.join(output, 'assets', 'logo.png')),
  cp(path.join(source, 'scripts', 'site.js'), path.join(output, 'assets', 'site.js')),
  cp(path.join(source, 'scripts', 'form.js'), path.join(output, 'assets', 'form.js')),
  cp(path.join(source, 'scripts', 'voucher.js'), path.join(output, 'assets', 'voucher.js')),
  cp(path.join(source, 'scripts', 'booking.js'), path.join(output, 'assets', 'booking.js'))
]);

const neededImages = new Set();
for (const page of pages) {
  neededImages.add(page.hero.image);
  neededImages.add(page.intro.image);
  for (const item of page.highlights || []) neededImages.add(item.image);
  for (const variant of Object.values(page.seasonal || {})) if (variant.heroImage) neededImages.add(variant.heroImage);
  if (page.winter?.image) neededImages.add(page.winter.image);
}
for (const season of Object.values(seasons)) neededImages.add(season.image);
for (const offer of offers) neededImages.add(offer.image);
for (const roomGroup of Object.values(content.rooms)) for (const room of roomGroup.items || []) neededImages.add(room.image);
for (const gallery of Object.values(content.galleries)) for (const item of gallery.items || []) neededImages.add(item.image);
for (const locale of Object.values(locales)) {
  for (const season of Object.values(locale.seasons || {})) if (season.image) neededImages.add(season.image);
  for (const roomGroup of Object.values(locale.rooms || {})) for (const room of roomGroup.items || []) neededImages.add(room.image);
  for (const gallery of Object.values(locale.galleries || {})) for (const item of gallery.items || []) neededImages.add(item.image);
}
for (const image of neededImages) {
  if (isExternalImage(image)) continue;
  if (hasOptimised(image, 720) && hasOptimised(image, 1440)) {
    await Promise.all([720, 1440].map((width) => cp(path.join(optimisedAssets, optimisedName(image, width)), path.join(output, 'assets', 'images', optimisedName(image, width)))));
    continue;
  }
  const curated = path.join(curatedAssets, image);
  const incoming = path.join(incomingAssets, image);
  const legacy = path.join(legacyAssets, image);
  const from = existsSync(curated) ? curated : existsSync(incoming) ? incoming : legacy;
  if (!existsSync(from)) throw new Error(`Missing image: ${image}`);
  await cp(from, path.join(output, 'assets', 'images', image));
}

for (const page of pages) {
  const routeDir = path.join(output, page.route.replace(/^\//, ''));
  await mkdir(routeDir, { recursive: true });
  await writeFile(path.join(routeDir, 'index.html'), render(page), 'utf8');
}

await writeFile(path.join(output, 'index.html'), '<!doctype html><meta http-equiv="refresh" content="0;url=/de/">', 'utf8');
console.log(`Built ${pages.length} page(s) in ${output} · active season: ${activeSeason}`);
