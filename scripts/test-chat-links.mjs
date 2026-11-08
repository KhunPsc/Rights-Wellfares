// Test how bot answers turn [[wiki page]] into links (formatChatText in src/sites/shared/core.js).
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const graph = { nodes: [
  { id: 'ค่าใช้จ่ายเดินทางไปปฏิบัติงาน', title: 'ค่าใช้จ่ายเดินทางไปปฏิบัติงาน', chapters: [{ book: 'kfn1', short: 'กฟน.1', ch: 11 }] },
  { id: 'บัญชี 2-3 ระเบียบเดินทาง', title: 'บัญชีแนบท้าย', chapters: [] },
] };
const store = { rw_bootstrap_v2: JSON.stringify({ version: 'x', data: { graph } }) };
const ctx = vm.createContext({
  window: { RW_CONFIG: {} },
  localStorage: { getItem: (k) => store[k] ?? null, setItem() {}, removeItem() {} },
  document: { readyState: 'complete', addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
});
vm.runInContext((await readFile('src/sites/shared/core.js', 'utf8')) + '\nthis.RW = RW;', ctx);
const fmt = (s) => ctx.RW.formatChatText(s);

const chapter = fmt('อ้างอิงจาก [[ค่าใช้จ่ายเดินทางไปปฏิบัติงาน]] ครับ');
assert.match(chapter, /<a href="book\.html\?book=kfn1&ch=11"[^>]*>ค่าใช้จ่ายเดินทางไปปฏิบัติงาน<\/a>/);
assert.doesNotMatch(chapter, /\[\[/);

assert.match(fmt('[[บัญชี 2-3 ระเบียบเดินทาง]]'), /href="map\.html\?topic=/, 'no chapter → knowledge map');
assert.match(fmt('[[บัญชีแนบท้าย|บัญชี 3]]'), />บัญชี 3<\/a>/, 'matches by title, shows alias');
assert.equal(fmt('ดู [[หน้าที่ไม่มี]]'), 'ดู หน้าที่ไม่มี', 'unknown page → plain text');
assert.equal(fmt('[[<b>x</b>]]'), '&lt;b&gt;x&lt;/b&gt;', 'still escaped');

// "ข้อ N" ในชื่อลิงก์ต้องไม่กลายเป็นปุ่มซ้อนในลิงก์ แต่ข้างนอกยังเป็นปุ่ม
const mixed = fmt('[[ค่าใช้จ่ายเดินทางไปปฏิบัติงาน|ข้อ 21]] และข้อ 7');
assert.match(mixed, />ข้อ 21<\/a>/);
assert.match(mixed, /RW\.openClause\(7\)/);
assert.doesNotMatch(mixed, /openClause\(21\)/);

console.log('chat link tests passed');
