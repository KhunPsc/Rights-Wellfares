// Build หน้าเว็บ: src/sites/pages/<page>.html (+ <page>.js) + shared/* → docs/<page>.html (GitHub Pages)
// Google Sites ฝัง URL ของ GitHub Pages ไว้ จึงไม่ต้องวางโค้ดใน Sites ใหม่ทุกครั้ง
import { readFile, writeFile, readdir, mkdir, copyFile, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'src', 'sites');
const docsDir = join(root, 'docs');

const read = (p) => readFile(join(srcDir, p), 'utf8');
const config = JSON.parse(await read('config.json'));
if (!config.apiUrl) throw new Error('src/sites/config.json: apiUrl is required');

const head = await read('shared/head.html');
// เรียก CLI ผ่าน node ตรง ๆ — ตัวเรียก node_modules/.bin บน Windows พังเพราะ "&" ในชื่อโฟลเดอร์โปรเจกต์
const tailwindCss = execFileSync(
  process.execPath,
  [join(root, 'node_modules', 'tailwindcss', 'lib', 'cli.js'), '-c', join(root, 'tailwind.config.cjs'), '-i', join(srcDir, 'shared', 'tailwind.css'), '--minify'],
  { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
);
if (!tailwindCss.includes('.bg-pea-700')) throw new Error('Tailwind output looks wrong (missing .bg-pea-700) — check tailwind.config.cjs');
const css = tailwindCss + '\n' + (await read('shared/ui.css'));
const core = await read('shared/core.js');
// วันที่ build = วันที่ปล่อยงานล่าสุด (ขั้นตอนปล่อยงานรัน build:sites ทุกครั้ง)
const nav = (await read('shared/nav.html')).replace('{{UPDATED}}', new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }));
if (nav.includes('{{')) throw new Error('nav.html: placeholder ที่ไม่รู้จัก');
const chatWidget = await read('shared/chat-widget.html');
const feedbackModal = await read('shared/feedback-modal.html');
const footer = await read('shared/footer.html');

// <!-- @include shared/xyz.html --> (relative to src/sites)
async function resolveIncludes(html) {
  const re = /<!--\s*@include\s+([\w./-]+)\s*-->/g;
  let out = html;
  for (const [tag, path] of html.matchAll(re)) {
    const content = await read(path);
    out = out.replace(tag, () => content); // function form: don't interpret "$" in content
  }
  return out;
}

function inlineScript(code, name) {
  if (/<\/script/i.test(code)) throw new Error(`${name}: contains "</script" — split it (e.g. "<\\/script")`);
  return `<script>\n${code.trim()}\n</script>`;
}

const pages = (await readdir(join(srcDir, 'pages'))).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5));
await mkdir(docsDir, { recursive: true });

for (const page of pages) {
  let body = await read(`pages/${page}.html`);
  const titleMatch = body.match(/^<!--\s*@title\s+(.+?)\s*-->\s*\n?/);
  const title = titleMatch ? titleMatch[1] : page;
  if (titleMatch) body = body.slice(titleMatch[0].length);
  body = await resolveIncludes(body);

  const jsPath = join(srcDir, 'pages', `${page}.js`);
  const pageJs = existsSync(jsPath) ? await readFile(jsPath, 'utf8') : '';
  const runtimeConfig = { apiUrl: config.apiUrl, linkTarget: config.linkTarget || '_blank', pages: config.pages || {}, page };

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
${head.trim()}
<style>
${css.trim()}
</style>
${inlineScript(`window.RW_CONFIG = ${JSON.stringify(runtimeConfig)};`, 'config')}
${inlineScript(core, 'shared/core.js')}
</head>
<body class="rw-embed">
${nav.trim()}
${body.trim()}
${chatWidget.trim()}
${feedbackModal.trim()}
${footer.trim()}
${pageJs ? inlineScript(pageJs, `pages/${page}.js`) : ''}
</body>
</html>
`;
  await writeFile(join(docsDir, `${page}.html`), html, 'utf8');
  console.log(`docs/${page}.html  ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
}

// GitHub Pages: create index.html and .nojekyll in docs/
if (existsSync(join(docsDir, 'home.html'))) {
  await copyFile(join(docsDir, 'home.html'), join(docsDir, 'index.html'));
}
await writeFile(join(docsDir, '.nojekyll'), '', 'utf8');

// Copy static assets from src/sites/assets -> docs/assets
const srcAssets = join(srcDir, 'assets');
if (existsSync(srcAssets)) {
  await cp(srcAssets, join(docsDir, 'assets'), { recursive: true });
  console.log('Copied static assets to docs/assets');
}
// รูปต้นฉบับที่หนังสือใช้ (vault/raw/assets) → assets/raw/ — ดู bookImage ใน build-data.mjs
const rawAssets = join(root, 'vault', 'raw', 'assets');
if (existsSync(rawAssets)) {
  await cp(rawAssets, join(docsDir, 'assets', 'raw'), { recursive: true });
}

const missing = Object.entries(config.pages || {}).filter(([, url]) => !url).map(([k]) => k);
if (missing.length) {
  console.warn(`\n⚠ ยังไม่ได้ตั้ง URL หน้าใน src/sites/config.json → pages: ${missing.join(', ')} (ปุ่มลิงก์ข้ามหน้าจะยังใช้ไม่ได้)`);
}
