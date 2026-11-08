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
const paths = ['', 'privacy-policy.html', 'support.html', 'terms-of-use.html'];
await writeFile(resolve(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locales.flatMap(l => paths.map(path => `  <url><loc>${base}/${l.lang === 'en' ? '' : l.lang + '/'}${path}</loc></url>`)).join('\n')}\n</urlset>\n`);
console.log(`Generated ${locales.length} static landing pages and sitemap.`);

await styleDocuments(root, locales, revisions);

await writeFile(resolve(root, 'llms.txt'), `# Animal Sounds: Learn & Play

> An educational animal-sounds app for iOS and Android by Mikhail Kostin, with a free browser demo for toddlers, preschoolers, and their parents or caregivers.

## Facts

- The website offers six real animal recordings: cow, dog, cat, sheep, duck, and horse. No sign-up is required. An internet connection is needed to load the demo.
- Tap an animal to hear its name (where a localized recording exists), then its sound. A three-round sound quiz is available in the browser.
- The app includes animal sounds, puzzles, quizzes, and a choice of real photos or cartoons.
- The app's free package includes 12 animals. Additional content is available through optional in-app purchases.
- Support: support@kostin.app

## Official links

- [Homepage and browser demo](${base}/)
- [App Store](https://apps.apple.com/us/app/animal-sounds-learn-play/id6748567850)
- [Google Play](https://play.google.com/store/apps/details?id=com.kostin.moo)
- [Support](${base}/support.html)
- [Privacy policy](${base}/privacy-policy.html)
- [Terms of use](${base}/terms-of-use.html)
- [Sitemap](${base}/sitemap.xml)

## Localized pages

${locales.map(l => `- [${l.language}](${base}/${l.lang === 'en' ? '' : l.lang + '/'})`).join('\n')}

## Audio samples

${['cow', 'dog', 'cat', 'sheep', 'duck', 'horse'].map(slug => `- [${slug}](${base}/assets/demo/${slug}.mp3)`).join('\n')}
`);
