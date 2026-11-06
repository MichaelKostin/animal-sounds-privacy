import { readFile, mkdir, copyFile, access, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/copy-demo-assets.mjs /absolute/path/to/moo');
const animals = JSON.parse(await readFile(resolve(source, 'assets/data/animals.json'), 'utf8'));
const constants = await readFile(resolve(source, 'constants/constants.ts'), 'utf8');
const size = Number(constants.match(/FREE_PACKAGE_SIZE\s*=\s*(\d+)/)?.[1]);
if (size !== 12) throw new Error('Free package changed: review website copy before exporting assets.');
const selected = ['cow', 'dog', 'cat', 'sheep', 'duck', 'horse'];
const free = new Set(animals.slice(0, size).map(a => a.slug));
const files = selected.flatMap(slug => {
  if (!free.has(slug)) throw new Error(`${slug} is not in the free package`);
  return [[`assets/images/animals/${slug}_512.png`, `${slug}.png`], [`assets/sounds/animals/${slug}.mp3`, `${slug}.mp3`]];
});
// Check all inputs before writing any output.
await Promise.all(files.map(([from]) => access(resolve(source, from))));
await mkdir(resolve(root, 'assets/demo'), { recursive: true });
for (const [from, to] of files) await copyFile(resolve(source, from), resolve(root, 'assets/demo', to));
console.log(`Copied ${files.length} existing assets for ${selected.length} free animals.`);

const exists = async path => { try { await access(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
for (const file of (await readdir(resolve(root, 'content/locales'))).filter(f => f.endsWith('.json'))) {
  const localePath = resolve(root, 'content/locales', file);
  const locale = JSON.parse(await readFile(localePath, 'utf8'));
  locale.speech = {};
  for (const slug of selected) {
    const input = resolve(source, `assets/speech/${locale.lang}/${slug}.mp3`);
    if (!await exists(input)) continue;
    const output = `assets/demo/speech/${locale.lang}/${slug}.mp3`;
    await mkdir(dirname(resolve(root, output)), { recursive: true });
    await copyFile(input, resolve(root, output));
    locale.speech[slug] = '/' + output;
  }
  const screenshotLocale = await exists(resolve(source, `maestro/screenshots/${locale.lang}-iPhone-Air-home-1-c.png`)) && await exists(resolve(source, `maestro/screenshots/${locale.lang}-iPhone-Air-home-1-p.png`)) ? locale.lang : 'en';
  const alt = locale.screenshots[0].alt;
  locale.screenshots = [];
  for (const style of ['c', 'p']) {
    const name = `${screenshotLocale}-iPhone-Air-home-1-${style}.png`;
    const output = `img/screenshots/${name}`;
    await mkdir(dirname(resolve(root, output)), { recursive: true });
    await copyFile(resolve(source, 'maestro/screenshots', name), resolve(root, output));
    locale.screenshots.push({ src: output, alt });
  }
  await writeFile(localePath, JSON.stringify(locale, null, 2) + '\n');
  console.log(`${locale.lang}: ${Object.keys(locale.speech).length} spoken names; ${screenshotLocale} iPhone screenshots`);
}
