// แผนที่ความรู้: อ่านหน้า wiki → { nodes, links } ให้หน้า map.html
// node = หน้าใน vault/wiki/<folder>/ · link = [[ลิงก์]] ระหว่างหน้า (ไม่มีทิศทาง ไม่ซ้ำ)
// สรุป = คำอธิบายใน index.md + 2–3 ประเด็นแรกของหน้า + หัวข้อ ## · บทหนังสือที่เกี่ยวข้องมาจาก topics ใน books.json/categories.json
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const FOLDER_TYPE = { welfare: 'welfare', rights: 'right', forms: 'form', agencies: 'agency', sources: 'source' };
const SKIP_PARA = /^(แหล่ง|ระเบียบต้นฉบับ|ที่มา|\(|ดู |ใช้ในหน้า|ประกาศ \d|PDF |รูปภาพ|สรุปจาก|ตาม )/;

export const cleanWiki = (s) => s
  .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
  .replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();

// ประเด็นแรก ๆ: ย่อหน้า / 2 ข้อแรกของรายการ / 2 แถวแรกของตาราง (ข้ามบรรทัดอ้างแหล่ง หัวข้อ กล่องหมายเหตุ)
export function keyPoints(body, max = 3) {
  const points = [];
  for (const raw of body.split(/\n\s*\n/)) {
    if (points.length >= max) break;
    const block = raw.split('\n').filter((l) => !/^#{1,6}\s/.test(l)).join('\n').trim();
    if (!block || /^(>|!\[|---)/.test(block)) continue;
    const lines = block.split('\n');
    if (/^\|/.test(block)) {
      lines.slice(2, 4).forEach((r) => {
        const c = r.split('|').map(cleanWiki).filter(Boolean);
        if (c.length > 1) points.push(`${c[0]}: ${c[1]}`);
      });
    } else if (/^\s*([-*]|\d+\.)\s/.test(lines[0])) {
      lines.filter((l) => /^([-*]|\d+\.)\s/.test(l)).slice(0, 2)
        .forEach((l) => points.push(cleanWiki(l.replace(/^([-*]|\d+\.)\s+/, ''))));
    } else if (!SKIP_PARA.test(cleanWiki(lines[0]))) {
      points.push(cleanWiki(lines.join(' ')));
    }
  }
  return points.filter(Boolean).slice(0, max).map((p) => (p.length > 160 ? p.slice(0, 158) + '…' : p));
}

export async function buildGraph(wikiDir, books) {
  const index = await readFile(join(wikiDir, 'index.md'), 'utf8');
  const blurb = {};
  for (const m of index.matchAll(/^- \[\[([^\]|]+)\]\]\s*—\s*(.+)$/gm)) blurb[m[1].trim()] = cleanWiki(m[2]);

  const nodes = [];
  const rawLinks = [];
  for (const [folder, type] of Object.entries(FOLDER_TYPE)) {
    for (const f of (await readdir(join(wikiDir, folder))).filter((x) => x.endsWith('.md')).sort()) {
      const text = await readFile(join(wikiDir, folder, f), 'utf8');
      const id = f.slice(0, -3);
      const title = (text.match(/^title:\s*"?(.+?)"?\s*$/m) || [, id])[1];
      const body = text.replace(/^---[\s\S]*?---\s*/, '');
      const headings = [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => cleanWiki(m[1]))
        .filter((h) => !/^(ดูเพิ่ม|ใช้ในหน้า|แหล่ง)/.test(h)).slice(0, 8);
      nodes.push({ id, title, type, summary: blurb[id] || '', points: keyPoints(body), headings, chapters: [] });
      for (const m of body.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) rawLinks.push([id, m[1].trim()]);
    }
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set();
  const links = [];
  for (const [a, b] of rawLinks) {
    if (a === b || !byId.has(b)) continue;
    const key = [a, b].sort().join('\u0000');
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ source: a, target: b });
  }

  for (const book of books) {
    for (const ch of book.chapters) {
      for (const t of ch.topics || []) {
        const n = byId.get(t);
        if (!n) throw new Error(`${book.id} บท ${ch.num}: topics อ้างหน้า wiki "${t}" ที่ไม่มี`);
        n.chapters.push({ book: book.id, short: book.short, ch: ch.num, title: ch.title, main: ch.topics[0] === t });
      }
    }
  }
  // บทที่หน้านี้เป็นหัวข้อหลัก (topics[0]) ขึ้นก่อน — ลิงก์ในคำตอบแชตใช้บทแรก
  for (const n of nodes) {
    n.chapters.sort((a, b) => b.main - a.main);
    n.chapters.forEach((c) => delete c.main);
  }
  return { nodes, links };
}
