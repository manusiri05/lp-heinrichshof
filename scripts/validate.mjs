import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const data = path.join(root, 'src', 'data');
const errors = [];

async function htmlFiles(folder) {
  const result = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) result.push(...await htmlFiles(file));
    else if (entry.name.endsWith('.html')) result.push(file);
  }
  return result;
}

for (const file of await htmlFiles(output)) {
  const html = await readFile(file, 'utf8');
  const relative = path.relative(output, file);
  if (relative === 'index.html' && /http-equiv="refresh"/i.test(html)) continue;
  const h1 = html.match(/<h1\b/g) || [];
  if (h1.length !== 1) errors.push(`${relative}: ${h1.length} H1-Überschriften`);

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) errors.push(`${relative}: doppelte IDs ${[...new Set(duplicates)].join(', ')}`);
  const idSet = new Set(ids);
  for (const match of html.matchAll(/href="#([^"]+)"/g)) {
    if (!idSet.has(match[1])) errors.push(`${relative}: Sprungziel #${match[1]} fehlt`);
  }
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    const assetPath = match[1].split(/[?#]/, 1)[0];
    const asset = path.join(output, assetPath.replace(/^\//, ''));
    if (!existsSync(asset)) errors.push(`${relative}: Asset fehlt ${match[1]}`);
  }
  if (/© 2025/.test(html)) errors.push(`${relative}: veraltete Jahreszahl 2025`);
  if (/Restplätze im Juni/i.test(html)) errors.push(`${relative}: veralteter Juni-Hinweis`);
  if (!html.includes("})(window,document,'script','dataLayer','GTM-KCNBCS8T');")) errors.push(`${relative}: GTM-Script fehlt`);
  if (!html.includes('https://www.googletagmanager.com/ns.html?id=GTM-KCNBCS8T')) errors.push(`${relative}: GTM-noscript fehlt`);
  if (relative === path.join('de', 'voucher', 'index.html')) {
    if (!html.includes('data-voucher-form')) errors.push(`${relative}: Gutschein-Anmeldung fehlt`);
    if (html.includes('data-lead-form')) errors.push(`${relative}: allgemeines Anfrageformular darf hier nicht enthalten sein`);
    if (html.includes('id="anfrage"') || html.includes('id="buchung"')) errors.push(`${relative}: Anfrage- oder Booking-Bereich darf hier nicht enthalten sein`);
    if (!html.includes('Ihr € 50,- Kennenlern-Geschenk für den nächsten Urlaub')) errors.push(`${relative}: Gutschein-Headline fehlt`);
  } else {
    if (!html.includes('data-pets-choice')) errors.push(`${relative}: Hunde-Auswahl fehlt`);
    if (!html.includes('name="pets_count" type="number" min="1" max="3" step="1"')) errors.push(`${relative}: Anzahl-Hunde-Feld ist fehlerhaft`);
  }
}

const pages = JSON.parse(await readFile(path.join(data, 'pages.json'), 'utf8'));
const routes = pages.map((page) => page.route);
const duplicateRoutes = routes.filter((route, index) => routes.indexOf(route) !== index);
if (duplicateRoutes.length) errors.push(`Doppelte Routen: ${[...new Set(duplicateRoutes)].join(', ')}`);

const offers = JSON.parse(await readFile(path.join(data, 'offers.json'), 'utf8'));
for (const offer of offers) {
  if (offer.displayFrom > offer.displayUntil) errors.push(`${offer.id}: Anzeigezeitraum ist umgekehrt`);
  if (offer.stayFrom > offer.stayTo) errors.push(`${offer.id}: Aufenthaltszeitraum ist umgekehrt`);
}

const locales = JSON.parse(await readFile(path.join(data, 'locales.json'), 'utf8'));
for (const [language, locale] of Object.entries(locales)) {
  for (const field of ['dog', 'dogNo', 'dogYes', 'dogCount', 'dogSingular', 'dogPlural']) {
    if (!locale.ui?.form?.[field]) errors.push(`${language}: Übersetzung für ${field} fehlt`);
  }
}

const formScript = await readFile(path.join(root, 'src', 'scripts', 'form.js'), 'utf8');
if (!formScript.includes('pets: pets')) errors.push('Lead-Payload enthält kein eigenständiges pets-Feld');
if (formScript.includes('messageParts.push(pets')) errors.push('pets darf nicht an message angehängt werden');
const voucherScript = await readFile(path.join(root, 'src', 'scripts', 'voucher.js'), 'utf8');
if (!voucherScript.includes("event: 'voucher_signup_success'")) errors.push('Voucher-Tracking-Event fehlt');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`${pages.length} Landingpages erfolgreich geprüft.`);
}
