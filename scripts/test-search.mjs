// Test the home-page search ranking (RW.searchIndex / RW.rankSearch in src/sites/shared/core.js) on the real data in apps-script/Data.js.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const ctx = vm.createContext({
  window: { RW_CONFIG: {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { readyState: 'complete', addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
});
vm.runInContext((await readFile('apps-script/Data.js', 'utf8')) + '\nthis.D = SITE_DATA;', ctx);
vm.runInContext((await readFile('src/sites/shared/core.js', 'utf8')) + '\nthis.RW = RW;', ctx);
const index = ctx.RW.searchIndex(ctx.D);
const search = (q) => ctx.RW.rankSearch(index, q);
const top = (q) => { const h = search(q)[0]; return h && `${h.book.id}/${h.ch.num}${h.clause ? '#' + h.clause : ''}`; };

// พิมพ์เป็นประโยค: ตัดคำถามทั่วไป + ลูก → บุตร แล้วเรียงตามความตรง
assert.equal(top('ลูกป่วยเบิกค่าห้องได้เท่าไหร่'), 'welfare44/2#7');
assert.equal(top('เมียคลอดลูก'), 'kfn1/3', 'เมีย → คู่สมรส, ลูก → บุตร');
assert.equal(top('ผชก.ไปต่างจังหวัดได้เบี้ยเลี้ยงเท่าไหร่'), 'kfn1/11', 'อักษรย่อมีจุดไม่ถูกตัดคำผิด');

// คำค้นแบบเดิมยังได้ข้อที่ตรงที่สุดเป็นอันดับแรก
assert.equal(top('ค่าห้อง'), 'welfare44/2#7');
assert.equal(top('90 วัน'), 'welfare44/1#14');
assert.equal(top('ล้างไต'), 'welfare44/4#19');

// "ลูก" ไม่ไปจับ "ลูกจ้าง" และ "ลูกจ้าง" ยังค้นได้ตรงตัว
assert.ok(search('ลูกจ้าง').every(h => h.found.includes('ลูกจ้าง')));
assert.ok(!search('ลูก').some(h => h.found.includes('ลูก')), 'ลูก ค้นด้วย บุตร แทน');

// ข้อความตัวอย่างมีคำที่ตรงอยู่ · คำที่ไม่มีในคู่มือ = ไม่พบ
for (const h of search('ค่ารถพยาบาล').slice(0, 5)) assert.ok(h.found.some(w => h.snippet.toLowerCase().includes(w)), h.title);
assert.equal(search('qqzzxx').length, 0);

console.log('search tests passed');
