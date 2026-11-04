// Check that the chatbot picks the right wiki pages for typical questions.
// Runs apps-script/Knowledge.js + Data.js + Chat.js in a sandbox (no Apps Script needed).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
const ctx = vm.createContext({});
for (const f of ['Knowledge.js', 'Data.js', 'Chat.js']) {
  vm.runInContext(await readFile(join(root, 'apps-script', f), 'utf8'), ctx, { filename: f });
}
const pick = (q) => vm.runInContext(`selectWikiPages_(${JSON.stringify(q)})`, ctx).map((p) => p.title);

const cases = [
  ['ลูกจ้างเบิกค่าเดินทางไปปฏิบัติงานได้ไหม', 'ค่าใช้จ่ายเดินทางไปปฏิบัติงาน'],
  ['เบิกค่าเล่าเรียนบุตรปริญญาตรีเอกชนได้เท่าไหร่', 'ค่าเล่าเรียน'],
  ['ทำ OT วันหยุดได้กี่เท่า', 'ค่าล่วงเวลา'],
  ['เงินช่วยเหลือบุตรลูกจ้างเดือนละเท่าไหร่', 'เงินช่วยเหลือบุตร'],
  ['คลอดลูกได้เงินช่วยเหลือเท่าไหร่', 'คลอดบุตร'],
  ['ค่าห้องพนักงานนอนโรงพยาบาลวันละเท่าไหร่', 'ค่าห้อง'],
  ['บินเชียงใหม่ไปดอนเมือง พนักงานระดับ 6 เบิกได้เท่าไหร่', 'ค่าใช้จ่ายเดินทางไปปฏิบัติงาน'],
  ['ค่าตั๋วเครื่องบินเบิกได้เท่าไหร่', 'ค่าใช้จ่ายเดินทางไปปฏิบัติงาน'],
  ['ค่าเคลือบฟลูออไรด์เบิกได้ไหม', 'รายการค่ารักษา'],
  ['เคลือบฟันลูกเบิกได้ไหม', 'รายการค่ารักษา'],
  ['อก. คือตำแหน่งอะไร ระดับเท่าไหร่', 'ตำแหน่ง'],
  ['หผ. ระดับเท่าไหร่', 'ตำแหน่ง'],
];

let failed = 0;
for (const [q, expected] of cases) {
  const titles = pick(q);
  const ok = titles.slice(0, 3).some((t) => t.includes(expected));
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${q}\n      → ${titles.join(' | ')}`);
}

// budget: never attach more than CHAT_WIKI_MAX_CHARS
const budget = vm.runInContext('CHAT_WIKI_MAX_CHARS', ctx);
const used = vm.runInContext(`selectWikiPages_("ค่ารักษาพยาบาล ค่าเดินทาง ค่าเล่าเรียน ค่าล่วงเวลา สวัสดิการ").reduce((n, p) => n + p.body.length, 0)`, ctx);
assert.ok(used <= budget, `wiki attachment ${used} > budget ${budget}`);
assert.equal(pick('hello').length, 0, 'unrelated question should attach nothing');

// prompt still builds with and without pages
const prompt = vm.runInContext(`buildSystemPrompt_(selectWikiPages_("ค่าเล่าเรียนบุตร"))`, ctx);
assert.ok(prompt.includes('ฐานความรู้เพิ่มเติม'), 'wiki section missing from prompt');
console.log(`\nprompt ${prompt.length.toLocaleString()} chars, wiki attachment budget ${budget.toLocaleString()}`);

assert.equal(failed, 0, `${failed} retrieval case(s) failed`);
console.log('all chat tests passed');
