import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFile(resolve(root, p), 'utf8');
const files = (await readdir(resolve(root, 'content/locales'))).filter(f=>f.endsWith('.json'));
const sitemap = await read('sitemap.xml');
for (const file of files) test(`${file}: crawlable localized page and complete assets`, async () => {
  const locale = JSON.parse(await read(`content/locales/${file}`));
  const path = locale.lang === 'en' ? 'index.html' : `${locale.lang}/index.html`;
  const html = await read(path);
  assert.match(html, new RegExp(`<html lang="${locale.lang}" dir="${locale.dir}">`));
  assert.equal((html.match(/<h1\b/g)||[]).length, 1);
  assert.doesNotMatch(html, /noindex|undefined|\bNaN\b/);
  assert.equal((html.match(/rel="alternate"/g)||[]).length, files.length+1);
  const canonical = html.match(/rel="canonical" href="([^"]+)"/)[1];
  assert.ok(sitemap.includes(`<loc>${canonical}</loc>`));
  assert.ok(html.includes(`hreflang="${locale.lang}" href="${canonical}"`));
  const app = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(app.url,canonical); assert.equal(app.name,locale.appName);
  assert.equal(app.inLanguage,locale.lang); assert.ok(!app.aggregateRating && !app.offers);
  const config = JSON.parse(html.match(/<script id="demo-config" type="application\/json">(.*?)<\/script>/s)[1]);
  assert.deepEqual(config.animals.map(a=>a.slug), ['cow','dog','cat','sheep','duck','horse']);
  assert.equal((html.match(/class="fallback-audio" controls preload="none"/g)||[]).length, 6);
  assert.match(html, /id="quiz"[^>]*hidden/);
  for (const a of config.animals) {
    assert.equal(a.name,locale.animals[a.slug]);
    if(a.speech) await access(resolve(root,a.speech.slice(1)));
  }
  assert.doesNotMatch(html, /id="stop-sound"/);
  assert.match(locale.screenshots[0].src, /iPhone-Air-home-1-c\.png$/);
  assert.match(locale.screenshots[1].src, /iPhone-Air-home-1-p\.png$/);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const ref=match[1].split('?')[0];
    if (/^(https?:|mailto:|#)/.test(ref)) continue;
    await access(resolve(root, ref.startsWith('/')?ref.slice(1):resolve(dirname(path),ref)));
  }
  for (const match of html.matchAll(/<img\b[^>]+>/g)) assert.match(match[0], /width="\d+" height="\d+"/);
  for (const shot of locale.screenshots) assert.ok(html.includes(`src="/${shot.src}"`));
  assert.ok(locale.round.includes('{current}') && locale.round.includes('{total}'));
  assert.equal(Object.keys(locale.animals).length,6);
});
test('build is deterministic and independent of Moo checkout', async () => {
  const paths=['index.html','sitemap.xml',...files.filter(f=>f!=='en.json').map(f=>f.replace('.json','/index.html'))];
  const before=await Promise.all(paths.map(read));
  execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root});
  assert.deepEqual(await Promise.all(paths.map(read)),before);
});
test('crawler policy allows search and retains GPTBot opt-out', async () => {
  const robots=await read('robots.txt');
  assert.match(robots,/User-agent: OAI-SearchBot\nAllow: \//);
  assert.match(robots,/User-agent: \*\nAllow: \//);
  assert.match(robots,/User-agent: GPTBot\nDisallow: \//);
  assert.match(robots,/Sitemap: https:\/\/animalsounds.kostin.app\/sitemap.xml/);
});
test('manifest references real icons and the app name', async () => {
  const manifest=JSON.parse(await read('img/site.webmanifest'));
  assert.equal(manifest.name,'Animal Sounds: Learn & Play');
  for(const icon of manifest.icons) await access(resolve(root,icon.src.slice(1)));
});
