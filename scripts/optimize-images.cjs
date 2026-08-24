const fs = require('node:fs/promises');
const path = require('node:path');
if (process.env.HF_NODE_MODULES) module.paths.unshift(process.env.HF_NODE_MODULES);
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const workspace = path.resolve(root, '..');
const source = path.join(root, 'src');
const curatedAssets = path.join(source, 'source-images');
const incomingAssets = path.join(workspace, 'assets');
const legacyAssets = path.join(workspace, 'lp-alt', 'assets');
const output = path.join(source, 'images');

async function readJson(name) {
  return JSON.parse(await fs.readFile(path.join(source, 'data', name), 'utf8'));
}

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

(async function optimise() {
  const [pages, seasons, offers, content, locales] = await Promise.all([
    readJson('pages.json'), readJson('seasons.json'), readJson('offers.json'), readJson('content.json'), readJson('locales.json')
  ]);
  const images = new Set();
  pages.forEach((page) => {
    images.add(page.hero.image);
    images.add(page.intro.image);
    (page.highlights || []).forEach((item) => images.add(item.image));
    Object.values(page.seasonal || {}).forEach((variant) => variant.heroImage && images.add(variant.heroImage));
  });
  Object.values(seasons).forEach((season) => images.add(season.image));
  offers.forEach((offer) => images.add(offer.image));
  Object.values(content.rooms).forEach((roomGroup) => (roomGroup.items || []).forEach((room) => images.add(room.image)));
  Object.values(content.galleries).forEach((gallery) => (gallery.items || []).forEach((item) => images.add(item.image)));
  Object.values(locales).forEach((locale) => {
    Object.values(locale.seasons || {}).forEach((season) => season.image && images.add(season.image));
    Object.values(locale.rooms || {}).forEach((roomGroup) => (roomGroup.items || []).forEach((room) => images.add(room.image)));
    Object.values(locale.galleries || {}).forEach((gallery) => (gallery.items || []).forEach((item) => images.add(item.image)));
  });

  await fs.mkdir(output, { recursive: true });
  for (const name of images) {
    if (/^https?:\/\//i.test(name)) continue;
    const curated = path.join(curatedAssets, name);
    const incoming = path.join(incomingAssets, name);
    const legacy = path.join(legacyAssets, name);
    const input = await exists(curated) ? curated : await exists(incoming) ? incoming : legacy;
    if (!(await exists(input))) throw new Error(`Bild fehlt: ${name}`);
    const base = path.parse(name).name;
    for (const width of [720, 1440]) {
      await sharp(input)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 })
        .toFile(path.join(output, `${base}-${width}.webp`));
    }
  }
  console.log(`${images.size} Bilder in zwei responsiven Größen optimiert.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
