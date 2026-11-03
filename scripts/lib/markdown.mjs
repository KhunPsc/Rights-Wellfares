// Markdown ชุดย่อยสำหรับเนื้อหาหนังสือ (vault/books/**) → HTML พร้อม class Tailwind
// รองรับ: ## / ### / #### หัวข้อ, ย่อหน้า, - และ 1. รายการ (ซ้อนด้วยการเว้น 2 ช่อง), | ตาราง |, > หมายเหตุ, **ตัวหนา**
// shortcut: ไม่รองรับลิงก์/รูป/โค้ด — ถ้าเนื้อหาต้องใช้ค่อยเพิ่ม หรือเปลี่ยนไปใช้ไลบรารี markdown

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => esc(s.trim()).replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');

const HEADING = {
  2: 'font-heading font-bold text-lg text-pea-800 mt-6 mb-2',
  3: 'font-heading font-bold text-base text-slate-800 mt-5 mb-2',
  4: 'font-heading font-semibold text-sm text-slate-800 mt-4 mb-1.5',
};
const LIST = { ul: 'list-disc pl-5 space-y-1.5 my-2', ol: 'list-decimal pl-5 space-y-1.5 my-2' };

function renderList(lines) {
  // lines: [{ indent, type, text }] → nested <ul>/<ol>
  let html = '';
  const stack = []; // { indent, type }
  for (const item of lines) {
    while (stack.length && item.indent < stack[stack.length - 1].indent) html += `</li></${stack.pop().type}>`;
    const top = stack[stack.length - 1];
    if (!top || item.indent > top.indent) {
      stack.push({ indent: item.indent, type: item.type });
      // รายการที่ถูกคั่นด้วยย่อหน้า/หมายเหตุ ต้องนับต่อจากเลขที่เขียนไว้ (เช่น "2." หลังกล่องหมายเหตุ)
      const start = item.type === 'ol' && item.num > 1 ? ` start="${item.num}"` : '';
      html += `<${item.type}${start} class="${LIST[item.type]}"><li>`;
    } else {
      html += '</li><li>';
    }
    html += inline(item.text);
  }
  while (stack.length) html += `</li></${stack.pop().type}>`;
  return html;
}

function renderTable(rows) {
  const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c));
  const [head, , ...body] = rows;
  const th = cells(head).map((c) => `<th class="px-3 py-2 text-left font-heading font-semibold">${c}</th>`).join('');
  const tr = body.map((r) => `<tr class="border-t border-slate-200">${cells(r).map((c) => `<td class="px-3 py-2 align-top">${c}</td>`).join('')}</tr>`).join('');
  return `<div class="overflow-x-auto my-3"><table class="w-full text-sm border border-slate-200 rounded-xl"><thead class="bg-purple-50 text-pea-900"><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

export function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length} class="${HEADING[h[1].length]}">${inline(h[2])}</h${h[1].length}>`); i++; continue; }

    if (/^\|/.test(line) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      out.push(renderTable(rows));
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<div class="my-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">${quote.map(inline).join('<br>')}</div>`);
      continue;
    }

    const listRe = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
    if (listRe.test(line)) {
      const items = [];
      while (i < lines.length && listRe.test(lines[i])) {
        const [, sp, mark, text] = lines[i++].match(listRe);
        items.push({ indent: sp.length, type: /\d/.test(mark) ? 'ol' : 'ul', num: parseInt(mark, 10), text });
      }
      out.push(renderList(items));
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|\||>|\s*([-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p class="my-2 leading-relaxed">${para.map(inline).join(' ')}</p>`);
  }
  return out.join('\n');
}
