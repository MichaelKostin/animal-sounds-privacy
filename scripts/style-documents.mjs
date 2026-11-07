import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { header } from './template.mjs';

// Keep authored document content intact while sharing the landing page chrome.
export async function styleDocuments(root, locales, revisions) {
  for (const locale of locales) {
    const directory = locale.lang === 'en' ? '' : locale.lang;
    const documents = [];
    for (const filename of ['privacy-policy.html', 'support.html', 'terms-of-use.html']) {
      const path = resolve(root, directory, filename);
      const html = await readFile(path, 'utf8');
      documents.push({ filename, path, html, title: html.match(/<h1[^>]*>(.*?)<\/h1>/s)[1] });
    }
    for (const { filename, path, html } of documents) {
      const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1];
      const content = (body.match(/<main[^>]*>([\s\S]*?)<\/main>/) || [null, body])[1].trim();
      const head = html.slice(0, html.indexOf('<body')).replace(/\s*<link rel="stylesheet"[^>]*>/g, '').replace('</head>', `<link rel="stylesheet" href="/css/index.css?v=${revisions['css/index.css']}">\n<link rel="stylesheet" href="/css/styles.css?v=${revisions['css/styles.css']}">\n</head>`);
      const footer = `<footer class="wrap"><p>© 2026 Mikhail Kostin</p><nav>${documents.map(doc => `<a href="${doc.filename}"${doc.filename === filename ? ' aria-current="page"' : ''}>${doc.title}</a>`).join('')}<a href="mailto:support@kostin.app">support@kostin.app</a></nav></footer>`;
      await writeFile(path, `${head}<body class="document-page">\n${header(locale, locales, filename)}\n<main class="document-content wrap">\n${content}\n</main>\n${footer}\n</body>\n</html>\n`);
    }
  }
}
