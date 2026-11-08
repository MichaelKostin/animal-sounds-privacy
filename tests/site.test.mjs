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
  assert.equal((html.match(/rel="alternate" hreflang=/g)||[]).length, files.length+1);
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
  const paths=['sitemap.xml','llms.txt',...files.flatMap(f=>['index.html','support.html','privacy-policy.html','terms-of-use.html'].map(path=>(f==='en.json'?'':f.replace('.json','/'))+path))];
  const before=await Promise.all(paths.map(read));
  execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root});
  assert.deepEqual(await Promise.all(paths.map(read)),before);
});
test('every sitemap URL is a distinct indexable page with reciprocal alternates', async () => {
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
  assert.equal(urls.length, files.length * 4);
  assert.equal(new Set(urls).size, urls.length);
  for (const url of urls) {
    const path = new URL(url).pathname.slice(1);
    const html = await read(path.endsWith('/') || !path ? path+'index.html' : path);
    assert.doesNotMatch(html, /noindex|nofollow/);
    assert.ok(html.includes(`rel="canonical" href="${url}"`));
    assert.equal((html.match(/rel="alternate" hreflang=/g)||[]).length, files.length+1);
    for (const m of html.matchAll(/rel="alternate" hreflang="[^"]+" href="([^"]+)"/g)) assert.ok(urls.includes(m[1]));
  }
});
test('agent guide and audio metadata point to real, public content', async () => {
  const guide = await read('llms.txt');
  for (const m of guide.matchAll(/\]\((https:\/\/animalsounds\.kostin\.app\/[^)]*)\)/g)) {
    const path = new URL(m[1]).pathname.slice(1);
    await access(resolve(root,path.endsWith('/') || !path ? path+'index.html' : path));
  }
  for (const file of files) {
    const locale=JSON.parse(await read(`content/locales/${file}`));
    const html=await read(locale.lang==='en'?'index.html':`${locale.lang}/index.html`);
    const blocks=[...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>JSON.parse(m[1]));
    const webpage=blocks[1]['@graph'].find(item=>item['@type']==='WebPage');
    assert.equal(webpage.hasPart.length,6);
    for (const audio of webpage.hasPart) {
      assert.ok(Object.values(locale.animals).includes(audio.name));
      await access(resolve(root,new URL(audio.contentUrl).pathname.slice(1)));
    }
  }
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
