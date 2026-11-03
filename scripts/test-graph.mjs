// Test the knowledge-map builder (scripts/lib/graph.mjs) on a tiny fake wiki.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildGraph, keyPoints, cleanWiki } from './lib/graph.mjs';

assert.equal(cleanWiki('ดู [[หน้า ก|ก]] และ **[[หน้า ข]]**'), 'ดู ก และ หน้า ข');
assert.deepEqual(keyPoints('แหล่ง: [[x]]\n\n## หัวข้อ\n- ข้อหนึ่ง\n- ข้อสอง\n- ข้อสาม'), ['ข้อหนึ่ง', 'ข้อสอง']);
assert.deepEqual(keyPoints('| ก | ข |\n|---|---|\n| พนักงาน | **1,500** |'), ['พนักงาน: 1,500']);

const dir = await mkdtemp(join(tmpdir(), 'wiki-'));
try {
  for (const f of ['welfare', 'rights', 'forms', 'agencies', 'sources']) await mkdir(join(dir, f));
  await writeFile(join(dir, 'index.md'), '- [[ค่าห้อง]] — 1,500 บาท/วัน\n');
  await writeFile(join(dir, 'welfare', 'ค่าห้อง.md'), '---\ntitle: ค่าห้อง\n---\n# ค่าห้อง\nดู [[ระเบียบ]] และ [[ระเบียบ|อีกครั้ง]] กับ [[ไม่มีหน้านี้]]\n');
  await writeFile(join(dir, 'sources', 'ระเบียบ.md'), '---\ntitle: ระเบียบ\n---\nอ้าง [[ค่าห้อง]]\n');
  const books = [{ id: 'b', short: 'B', chapters: [{ num: 2, title: 'บทสอง', topics: ['ค่าห้อง'] }] }];
  const g = await buildGraph(dir, books);
  assert.equal(g.nodes.length, 2);
  assert.equal(g.links.length, 1, 'duplicate/reverse links merged, missing pages dropped');
  const room = g.nodes.find((n) => n.id === 'ค่าห้อง');
  assert.equal(room.summary, '1,500 บาท/วัน');
  assert.equal(room.type, 'welfare');
  assert.deepEqual(room.chapters, [{ book: 'b', short: 'B', ch: 2, title: 'บทสอง' }]);
  books[0].chapters[0].topics = ['ไม่มีหน้านี้'];
  await assert.rejects(buildGraph(dir, books), /ไม่มีหน้านี้/);
} finally {
  await rm(dir, { recursive: true, force: true });
}
console.log('graph tests passed');
