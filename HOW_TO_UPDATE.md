# คู่มือเพิ่ม/แก้เนื้อหา (Content Update Guide)

ขั้นตอนเพิ่มหรือแก้ระเบียบ หนังสือเวียน บทในหนังสือ ข่าว และตัวเลขสำคัญ ของระบบสิทธิและสวัสดิการ กฟภ.
กฎการเขียน wiki (แหล่งอ้างอิง, ข้อมูลขัดแย้ง, ชื่อไฟล์) อยู่ใน [CLAUDE.md](CLAUDE.md) — ถ้าใช้ Claude Code สั่งว่า "ingest ไฟล์ ..." ได้เลย

## ภาพรวม: ข้อมูลไหลไปไหน

```
vault/wiki/*.md ──────────────┐      (build-knowledge) → apps-script/Knowledge.js → แชตบอท
vault/books/<เล่ม>/<บท>.md ──┤
src/data/*.json ──────────────┴──── (build-data) → apps-script/Data.js → หน้าเว็บ (ผ่าน API bootstrap)
src/sites/ ──────────────────────── (build-sites) → docs/*.html → GitHub Pages → Google Sites
```

ข้อมูลที่หน้าเว็บแสดง (หนังสือ คู่มือ 44 ข้อ ข่าว การ์ด แผนที่) มาจาก Apps Script → แก้แล้วต้อง `npm run deploy`
หน้าตา/โค้ดหน้าเว็บอยู่ที่ GitHub Pages → แก้แล้วต้อง `npm run build:sites` + `git push`

## 1. เพิ่มเอกสารใหม่เข้าฐานความรู้ (wiki)

1. วาง PDF ใน `vault/raw/pdf/` (ชื่อสั้น — ไม่ขึ้น git) · ถ้าเป็นสแกน ถอดข้อความไว้ที่ `vault/raw/text/` (บรรทัดแรกหมายเหตุว่าถอดจากภาพ)
2. สร้างหน้าสรุป `vault/wiki/sources/<ชื่อเอกสาร>.md` (frontmatter: `title`, `type: source`, `raw`, `published`, `tags`)
3. แก้หน้าหัวข้อที่เกี่ยวข้องใน `vault/wiki/welfare|rights|forms|agencies/` — ทุกตัวเลขอ้าง `[[หน้าใน sources]]`
4. เพิ่มบรรทัดใน `vault/wiki/index.md` แบบ `- [[ชื่อหน้า]] — คำอธิบายหนึ่งบรรทัด` (คำอธิบายนี้ขึ้นเป็นสรุปในแผนที่ความรู้)
5. เพิ่ม `## YYYY-MM-DD ingest | ชื่อเอกสาร` ใน `vault/wiki/log.md`
6. ข้อมูลขัดแย้ง: ยึดเอกสารที่ออกล่าสุด เก็บฉบับเก่าเป็นหมายเหตุ (รายละเอียดใน CLAUDE.md)

แชตบอทใช้หน้าใน `welfare/ rights/ forms/ agencies/` ตอบ (ไม่ใช้ `sources/`) — คำถามที่บอทหาหน้าไม่เจอ แก้ด้วยการเพิ่ม `tags` ในหน้านั้น หรือเพิ่มคำพ้องใน `CHAT_SYNONYMS` (`apps-script/Chat.js`) แล้วเพิ่มเคสใน `scripts/test-chat.mjs`

## 2. หนังสือบนชั้น

- รายชื่อเล่มและบท: `src/data/books.json` — เพิ่มเล่ม = เพิ่ม object (`id`, `title`, `short`, `edition`, `icon`, `chapters`)
- เนื้อหาบท: `vault/books/<id>/<เลขบท 2 หลัก>.md` (ไม่มีไฟล์ = ขึ้น "กำลังจัดทำ")
- Markdown ที่รองรับ: `##`–`####`, ย่อหน้า, `-` / `1.` (ซ้อนด้วยเว้น 2 ช่อง), `| ตาราง |`, `> หมายเหตุ`, `**ตัวหนา**`, รูปทั้งบรรทัด `![คำอธิบาย](../../raw/assets/ไฟล์.jpg)` (ไฟล์ต้องอยู่ใน `vault/raw/assets/` — จะเผยแพร่สาธารณะ)
- แต่ละบทใส่ `topics: ["ชื่อหน้า wiki", ...]` เพื่อผูกกับแผนที่ความรู้ (build ล้มถ้าอ้างหน้าที่ไม่มี)
- บทที่ชี้ไปเล่มอื่น: `link: { book, label, text }` · ปุ่มเครื่องมือ: `tools: [{ page, label, icon }]`
- เล่มคู่มือ 44 ข้อ (`welfare44`) สร้างจาก `categories.json` + `clauses.json` อัตโนมัติ — แก้ที่สองไฟล์นั้น

## 3. คู่มือ 44 ข้อ / หลักเกณฑ์ (`clauses.json`, `categories.json`)

- ข้อปกติ: `num` เป็นตัวเลข · หลักเกณฑ์/หนังสือเวียนที่ไม่มีเลขข้อ: `num` เป็นข้อความ เช่น `"guidelines-weight-loss-pen"` (แสดงเป็นการ์ดในบท "หลักเกณฑ์และแนวทางอื่น ๆ")
- ฟิลด์: `num`, `page`, `cat`, `title`, `summary`, `content` (HTML พร้อม class Tailwind)
- หมวด (`categories.json`) = 1 บทในเล่ม 44 ข้อ: `id`, `name`, `icon`, `clauses`, `topics`

## 4. ข่าว / ป๊อปอัป (`news.json`)

ฟิลด์: `id`, `date`, `badge`, `isNew`, `title`, `ref`, `signer`, `contact`, `summary`, `criteria`, `requirement`, `restriction` — แสดงในแถบข่าวหน้าแรกและป๊อปอัปรายละเอียด

## 5. ตัวเลขสำคัญ (`facts.json`)

อัตราที่เขียนซ้ำหลายที่ (ค่าห้อง, OPD, เบี้ยเลี้ยง, ที่พัก, การ์ดหน้าแรก ฯลฯ) — แก้ค่าที่ `src/data/facts.json` ก่อน แล้ว `npm run build` จะบอกทุกจุดที่ยังเป็นค่าเก่า (wiki, `clauses.json`, `chat-prompt.md`, `allowance-rates.json`, `highlights.json`)

## 6. การ์ดหน้าแรก "เกิดอะไรขึ้นกับคุณ?" (`highlights.json`)

`id`, `icon` (Font Awesome), `color` (purple / pink / blue / emerald / indigo / amber / orange / slate), `title`, `figure`, `book`, `ch` — ตัวเลขใน `figure` ควรผูกไว้ใน `facts.json` ด้วย location `highlight:<id>`

## 7. Build, ทดสอบ, ปล่อยงาน

```powershell
npm test                 # ต้องผ่านทั้งหมด
npm run build            # ตรวจ facts + สร้าง Data.js / Knowledge.js
npm.cmd run deploy       # ขึ้น Apps Script (deployment เดิม URL ไม่เปลี่ยน)
npm run build:sites      # ถ้าแก้หน้าเว็บ (src/sites) หรือรูปในหนังสือ
git add -A; git commit -m "..."; git push   # GitHub Pages อัปเดตเองใน ~1–2 นาที
```

ห้าม `npx clasp ...` — ชื่อโฟลเดอร์มี `&` ทำให้ตัวเรียกใน `node_modules/.bin` พัง ใช้ `clasp` แบบ global ผ่าน `npm run push` / `npm run deploy`

## เช็กลิสต์หลังปล่อยงาน

- [ ] หน้าแรก: แถบข่าว, การ์ดเหตุการณ์, ชั้นหนังสือ, ช่องค้นหาเจอเนื้อหาใหม่
- [ ] หนังสือ: บทใหม่แสดงถูก, สารบัญครบ, ปุ่ม "ดูในแผนที่ความรู้" ไปถูกหัวข้อ
- [ ] แผนที่ความรู้: หัวข้อใหม่มีจุดและเส้น, ปุ่ม "อ่านในหนังสือ" ไปถูกบท
- [ ] แชต AI: ถามเรื่องใหม่แล้วตอบถูกและอ้างแหล่งได้
