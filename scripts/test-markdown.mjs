// Test the book markdown converter (scripts/lib/markdown.mjs).
import assert from 'node:assert/strict';
import { markdownToHtml as md } from './lib/markdown.mjs';

assert.match(md('## หัวข้อ'), /^<h2 class="[^"]+">หัวข้อ<\/h2>$/);
assert.match(md('บรรทัด 1\nบรรทัด 2'), /<p[^>]*>บรรทัด 1 บรรทัด 2<\/p>/);
assert.match(md('**หนา** ปกติ'), /<strong[^>]*>หนา<\/strong> ปกติ/);
assert.ok(!md('<script>x</script>').includes('<script>'), 'HTML must be escaped');

const nested = md('- ก\n  - ข\n  - ค\n- ง');
assert.equal((nested.match(/<ul/g) || []).length, 2, 'nested list');
assert.match(nested, /<li>ก<ul[^>]*><li>ข<\/li><li>ค<\/li><\/ul><\/li><li>ง<\/li><\/ul>/);
assert.match(md('1. หนึ่ง\n2. สอง'), /<ol class="[^"]+"><li>หนึ่ง<\/li><li>สอง<\/li><\/ol>/);
assert.match(md('1. หนึ่ง\n\n> คั่น\n\n2. สอง'), /<ol start="2" class=/, 'list resumes numbering after a break');

const table = md('| ก | ข |\n|---|---|\n| 1 | 2 |');
assert.match(table, /<th[^>]*>ก<\/th><th[^>]*>ข<\/th>/);
assert.match(table, /<td[^>]*>1<\/td><td[^>]*>2<\/td>/);

assert.match(md('> หมายเหตุ'), /<div class="[^"]*amber[^"]*">หมายเหตุ<\/div>/);
assert.equal((md('## ก\nย่อหน้า\n- รายการ').match(/<(h2|p|ul)/g) || []).length, 3, 'block boundaries');

console.log('markdown tests passed');
