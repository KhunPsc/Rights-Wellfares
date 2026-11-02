// Build Google Sites embed code: src/sites/pages/<page>.html (+ <page>.js) + shared/* → dist/sites/<page>.html
// แต่ละไฟล์ใน dist/sites/ คือโค้ดที่นำไปวางใน Google Sites → แทรก → ฝัง (Embed) → "ฝังโค้ด"
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'src', 'sites');
const outDir = join(root, 'dist', 'sites');

const read = (p) => readFile(join(srcDir, p), 'utf8');
const config = JSON.parse(await read('config.json'));
if (!config.apiUrl) throw new Error('src/sites/config.json: apiUrl is required');

const head = await read('shared/head.html');
const css = await read('shared/ui.css');
const core = await read('shared/core.js');
const nav = await read('shared/nav.html');
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
await mkdir(outDir, { recursive: true });

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
${page !== 'home' ? nav.trim() + '\n' : ''}${body.trim()}
${page !== 'chat' ? chatWidget.trim() + '\n' : ''}${feedbackModal.trim()}
${footer.trim()}
${pageJs ? inlineScript(pageJs, `pages/${page}.js`) : ''}
</body>
</html>
`;
  await writeFile(join(outDir, `${page}.html`), html, 'utf8');
  console.log(`dist/sites/${page}.html  ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
}

const missing = Object.entries(config.pages || {}).filter(([, url]) => !url).map(([k]) => k);
if (missing.length) {
  console.warn(`\n⚠ ยังไม่ได้ตั้ง URL หน้าใน src/sites/config.json → pages: ${missing.join(', ')} (ปุ่มลิงก์ข้ามหน้าจะยังใช้ไม่ได้)`);
}
