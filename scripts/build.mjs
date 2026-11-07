import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { page } from './template.mjs';
import { styleDocuments } from './style-documents.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const locales = [];
for (const f of (await readdir(resolve(root, 'content/locales'))).filter(f => f.endsWith('.json')).sort()) {
  locales.push(JSON.parse(await readFile(resolve(root, 'content/locales', f), 'utf8')));
}
const keys = Object.keys(locales.find(l => l.lang === 'en')).sort().join();
for (const locale of locales) {
  if (Object.keys(locale).sort().join() !== keys) throw new Error(`Missing translation fields: ${locale.lang}`);
  if (Object.values(locale).some(v => v === '')) throw new Error(`Empty translation: ${locale.lang}`);
  for (const shot of locale.screenshots) {
    const buffer = await readFile(resolve(root, shot.src));
    shot.width = buffer.readUInt32BE(16); shot.height = buffer.readUInt32BE(20);
  }
}
const revisions = {};
for (const asset of ['css/index.css', 'css/styles.css', 'js/demo.js']) revisions[asset] = createHash('sha256').update(await readFile(resolve(root, asset))).digest('hex').slice(0, 12);
for (const locale of locales) await writeFile(resolve(root, locale.lang === 'en' ? 'index.html' : `${locale.lang}/index.html`), page(locale, locales, revisions));
const base = 'https://animalsounds.kostin.app';
await writeFile(resolve(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locales.map(l => `  <url><loc>${base}/${l.lang === 'en' ? '' : l.lang + '/'}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`Generated ${locales.length} static landing pages and sitemap.`);

await styleDocuments(root, locales, revisions);
