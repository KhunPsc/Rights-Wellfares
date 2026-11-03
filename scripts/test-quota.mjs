// Test apps-script/Quota.js with in-memory stand-ins for Cache/Properties/Lock/Utilities.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let now = new Date('2026-11-03T10:00:05Z');
const cache = new Map();
const props = new Map();
const ctx = {
  Date: class extends Date { constructor(...a) { super(...(a.length ? a : [now])); } },
  CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
  console,
};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../apps-script/Quota.js', import.meta.url), 'utf8'), ctx);
const take = (name) => vm.runInContext(`takeQuota_('${name}')`, ctx);

// ต่อนาที: feedback ได้ 10 ครั้ง ครั้งที่ 11 ถูกปฏิเสธ พร้อมเวลารอ
for (let i = 0; i < 10; i++) assert.equal(take('feedback').ok, true, `feedback #${i + 1}`);
const blocked = take('feedback');
assert.equal(blocked.ok, false);
assert.equal(blocked.reason, 'minute');
assert.equal(blocked.retryAfter, 55);

// นาทีใหม่ใช้ได้อีก จนครบ 100 ต่อวัน
for (let m = 1; m <= 9; m++) {
  now = new Date(now.getTime() + 60000);
  for (let i = 0; i < 10; i++) assert.equal(take('feedback').ok, true, `minute ${m} #${i + 1}`);
}
now = new Date(now.getTime() + 60000);
assert.equal(take('feedback').reason, 'day', 'day cap 100');

// วันใหม่รีเซ็ต · ตัวนับแต่ละชื่อแยกกัน
assert.equal(take('chat').ok, true, 'chat counter is separate');
now = new Date('2026-11-04T10:00:00Z');
assert.equal(take('feedback').ok, true, 'new day resets');

console.log('quota tests passed');
