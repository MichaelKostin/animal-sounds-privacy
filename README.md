# Animal Sounds website

Static multilingual homepage and six-animal browser demo, served from this repository at https://animalsounds.kostin.app. No backend, runtime dependencies, analytics, or automatic audio playback.

## Editing and building

- Edit localized content in `content/locales/*.json`, the shared markup in `scripts/template.mjs`, styles in `css/index.css`, and interaction logic in `js/demo.js`.
- Run `npm run build` to regenerate all 19 committed landing pages and `sitemap.xml`. Node.js 18+ is sufficient; dependency installation is unnecessary.
- Run `npm test` for generated-page validation and demo behavior tests. The behavior tests use a small DOM/audio harness; they do not replace browser/device checks.
- Preview with `python3 -m http.server 8087 --bind 127.0.0.1` and open http://127.0.0.1:8087. Root-relative assets require HTTP serving. Language navigation deliberately uses the canonical production URLs; visit `/ar/`, `/pl/`, etc. directly for local previews.

The generated HTML is the deployable output. No build step or Moo checkout is needed on the host. Existing language, privacy, support, and terms URLs are retained.

## Existing Moo assets

Refresh the selected cow, dog, cat, sheep, duck, and horse assets:

```sh
node scripts/copy-demo-assets.mjs /absolute/path/to/moo
```

The script checks Moo’s catalog and `FREE_PACKAGE_SIZE` before copying the six existing 512px cartoon PNGs and MP3 recordings. It refuses a changed free-package size or a selected animal outside that package. It also copies available spoken-name recordings for each website language and current Maestro iPhone cartoon/photo home screenshots (falling back to English screenshots where needed). All assets are committed locally. Persian and Urdu currently have no matching spoken-name recordings.

Animal names and existing quiz labels were copied from Moo’s locale files; Urdu labels were supplied locally where the source locale was absent. Additional website copy is stored in each locale JSON. Screenshots come from `maestro/screenshots/*-iPhone-Air-home-1-{c,p}.png`; languages without corresponding screenshots explicitly disclose that screens may appear in English. When refreshing names or the free package, review the website locale copy as well.

## Browser verification

Check desktop and mobile Safari/Chrome before release:

- No audio request before a tap; six cards play the localized name, where available, then the animal sound. The play icon becomes a stop icon during both clips; tapping the same card again stops playback. Rapid taps on different cards replace playback. Scrolling out of the demo, leaving the page, and hiding the tab stop audio.
- Quiz stays sound-only to avoid revealing the answer: three distinct targets, three distinct choices each, replay, retry after a wrong answer, explicit next controls, completion, and restart.
- Failed audio requests show a localized error and remain retryable.
- Keyboard focus is visible; replay/next/completion receive focus at the right times. Check 320px-wide layouts, long translations, RTL, and reduced motion.
- With JavaScript disabled, names, content, links, and native audio controls remain available; the quiz remains hidden.

## Search and release

`robots.txt` allows public/search crawlers, explicitly allows OAI-SearchBot, and preserves the previous training opt-out for GPTBot. Each landing page has a canonical URL, reciprocal language alternates, an English fallback, social metadata, and factual SoftwareApplication structured data. Legal-page indexing directives remain unchanged.

After publishing through the repository’s existing hosting workflow:

1. Verify the live `robots.txt`, sitemap, canonical URLs, all locale pages, and sample image/audio responses.
2. In the site owner’s Google Search Console and Bing Webmaster Tools accounts, verify ownership if needed and submit `https://animalsounds.kostin.app/sitemap.xml`. No account credentials or verification tokens are included here.
3. Check index coverage after launch; compare search impressions, clicks, and queries over the following 4–8 weeks. Search and ChatGPT inclusion are not guaranteed. No tracking script or recurring monitoring job is added.

Deployment and webmaster submissions are separate from generating the local files.
