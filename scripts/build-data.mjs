// Bundle src/data/* into apps-script/Data.js (served by doGet ?action=bootstrap and used by the chat prompt).
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { markdownToHtml } from './lib/markdown.mjs';
import { buildGraph } from './lib/graph.mjs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dataDir = join(root, 'src', 'data');
const outFile = join(root, 'apps-script', 'Data.js');

const readJson = async (name) => JSON.parse(await readFile(join(dataDir, name), 'utf8'));

const data = {
  categories: await readJson('categories.json'),
  clauses: await readJson('clauses.json'),
  allowanceRates: await readJson('allowance-rates.json'),
  wizard: await readJson('wizard.json'),
  forms: await readJson('forms.json'),
  news: await readJson('news.json'),
  books: await readJson('books.json'),
  highlights: (await readJson('highlights.json')).highlights,
};

// เนื้อหาแต่ละบท: vault/books/<book id>/<เลขบท 2 หลัก>.md — ยังไม่มีไฟล์ = บทนั้น "กำลังจัดทำ" (content: null)
// รูปในบท: เขียน path แบบ Obsidian (เทียบกับไฟล์ .md) ได้เฉพาะไฟล์ใน vault/raw/assets/ — build-sites คัดลอกไปไว้ที่ assets/raw/
const rawAssets = join(root, 'vault', 'raw', 'assets');
function bookImage(mdFile, src) {
  if (/^https:\/\//.test(src)) return src;
  const abs = resolve(dirname(mdFile), src);
  const rel = relative(rawAssets, abs);
  if (rel.startsWith('..') || !existsSync(abs)) throw new Error(`${mdFile}: รูป "${src}" ต้องอยู่ใน vault/raw/assets/ และต้องมีไฟล์จริง`);
  return 'assets/raw/' + rel.split(sep).map(encodeURIComponent).join('/');
}
for (const book of data.books) {
  if (book.fromCategories) {
    // เล่มคู่มือ 44 ข้อ: บท = หมวดใน categories.json · หน้าเว็บดึงเนื้อหาจาก clauses ตามรายการ ch.clauses (ไม่ซ้ำข้อมูลใน bootstrap)
    book.chapters = data.categories.filter((c) => c.clauses).map((c, i) => ({
      num: i + 1, title: c.name.replace(/^\d+\.\s*/, ''), clauses: c.clauses, topics: c.topics,
    }));
    continue;
  }
  for (const ch of book.chapters) {
    const file = join(root, 'vault', 'books', book.id, `${String(ch.num).padStart(2, '0')}.md`);
    ch.content = existsSync(file) ? markdownToHtml(await readFile(file, 'utf8'), { image: (src) => bookImage(file, src) }) : null;
  }
}
// แผนที่ความรู้ (หน้า map) — node จาก vault/wiki, บทที่เกี่ยวข้องจาก topics ของแต่ละบท
data.graph = await buildGraph(join(root, 'vault', 'wiki'), data.books);
const chatPrompt = (await readFile(join(dataDir, 'chat-prompt.md'), 'utf8')).trim();

// sanity checks — catch broken edits before they reach production
const nums = new Set(data.clauses.map((c) => c.num));
for (const cat of data.categories) {
  for (const n of cat.clauses || []) {
    if (!nums.has(n)) throw new Error(`category ${cat.id} refers to missing clause ${n}`);
  }
}
for (const c of data.clauses) {
  if (!c.num || !c.title || !c.content) throw new Error(`clause ${c.num} missing num/title/content`);
}
for (const h of data.highlights) {
  const book = data.books.find((b) => b.id === h.book);
  if (!book || !book.chapters.some((c) => c.num === h.ch)) throw new Error(`highlights.json: ${h.id} ชี้ไปบทที่ไม่มี (${h.book} บท ${h.ch})`);
}

// ตัวเลขสำคัญต้องตรงกันทุกที่ (wiki / clauses.json / chat-prompt.md / allowance-rates.json) — ดู src/data/facts.json
// shortcut: ตรวจแค่ว่ามีตัวเลขนั้นอยู่ — ถ้าแก้บางจุดแต่ยังเหลือค่าเดิมจุดอื่นในที่เดียวกันจะไม่จับ; ถ้าเจอปัญหานี้ค่อยเพิ่มรายการ "ค่าเก่าที่ห้ามมี"
const { facts } = await readJson('facts.json');
const wikiDir = join(root, 'vault', 'wiki');
async function sourceText(loc) {
  const [kind, ref] = loc.split(/:(.*)/);
  if (kind === 'prompt') return chatPrompt;
  if (kind === 'highlight') {
    const h = data.highlights.find((x) => x.id === ref);
    if (!h) throw new Error(`facts.json: highlight ${ref} not found`);
    return h.title + ' ' + h.figure;
  }
  if (kind === 'wiki') return readFile(join(wikiDir, ref), 'utf8');
  if (kind === 'clause') {
    const c = data.clauses.find((x) => String(x.num) === ref);
    if (!c) throw new Error(`facts.json: clause ${ref} not found`);
    return [c.title, c.summary, c.content].join(' ').replace(/<[^>]+>/g, ' ');
  }
  throw new Error(`facts.json: unknown location "${loc}"`);
}
const mismatches = [];
for (const f of facts) {
  for (const loc of f.in) {
    if (!(await sourceText(loc)).includes(f.text)) mismatches.push(`${f.fact}: ไม่พบ "${f.text}" ใน ${loc}`);
  }
  if (f.rate) {
    const actual = f.rate.split('.').reduce((o, k) => o?.[k], data.allowanceRates);
    if (actual !== Number(f.text.replace(/,/g, ''))) mismatches.push(`${f.fact}: allowance-rates.json ${f.rate} = ${actual} แต่ facts.json = ${f.text}`);
  }
}
if (mismatches.length) {
  throw new Error(`ตัวเลขไม่ตรงกัน ${mismatches.length} จุด — แก้ให้ตรงกับ src/data/facts.json:\n  ` + mismatches.join('\n  '));
}

const json = JSON.stringify(data);
const version = createHash('sha1').update(json + chatPrompt).digest('hex').slice(0, 10);

const banner = '// GENERATED by scripts/build-data.mjs — do not edit. Edit src/data/* then run `npm run build`.\n';
await writeFile(
  outFile,
  `${banner}const DATA_VERSION = ${JSON.stringify(version)};\n` +
    `const CHAT_PROMPT_HEADER = ${JSON.stringify(chatPrompt)};\n` +
    `const SITE_DATA = ${json};\n`,
  'utf8',
);

const chapters = data.books.flatMap((b) => b.chapters);
console.log(`Data.js: version ${version}, ${data.clauses.length} clauses, books ${chapters.filter((c) => c.content || c.clauses).length}/${chapters.length} chapters ready, ${json.length.toLocaleString()} chars`);
