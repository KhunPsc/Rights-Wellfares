# Rights & Welfares — LLM Wiki

ฐานความรู้เรื่องสิทธิและสวัสดิการ ดูแลโดย LLM (แนวทาง "LLM Wiki") เปิดอ่านด้วย Obsidian
แล้วนำไปใช้เป็นฐานความรู้ของ chatbot (Google Apps Script) ที่ฝังอยู่ใน Google Sites

## โครงสร้าง

```
vault/                 Obsidian vault (เปิดโฟลเดอร์นี้ใน Obsidian)
  raw/                 เอกสารต้นฉบับ — ห้ามแก้ไข อ่านอย่างเดียว
    assets/            รูป/ไฟล์แนบ
  wiki/                หน้าความรู้ที่ LLM เขียนและดูแล
    index.md           สารบัญทุกหน้า (อัปเดตทุกครั้งที่เพิ่ม/ลบหน้า)
    log.md             บันทึกการเปลี่ยนแปลง (append-only)
    overview.md        ภาพรวมทั้งหมด
    rights/            สิทธิแต่ละประเภท
    welfare/           สวัสดิการแต่ละรายการ
    agencies/          หน่วยงานที่เกี่ยวข้อง
    forms/             แบบฟอร์ม/เอกสารที่ต้องใช้
    sources/           สรุปของเอกสารต้นฉบับแต่ละชิ้นใน raw/
  templates/           เทมเพลตหน้า
apps-script/           โค้ด chatbot (push ด้วย clasp)
scripts/               build-knowledge.mjs: รวม wiki/ → apps-script/Knowledge.js
```

## กฎการเขียน wiki

- ภาษาไทยเป็นหลัก ศัพท์เฉพาะใส่ภาษาอังกฤษในวงเล็บได้
- ชื่อไฟล์เป็นภาษาไทยได้ เว้นวรรคได้ ไม่มีอักขระ `/ \ : * ? " < > |`
- ทุกหน้ามี frontmatter ตาม [templates/topic.md](vault/templates/topic.md): `title`, `type`, `tags`, `sources`, `updated`
- ลิงก์ระหว่างหน้าใช้ `[[ชื่อหน้า]]` ของ Obsidian
- ทุกข้อเท็จจริง (จำนวนเงิน เงื่อนไข วันที่ ขั้นตอน) ต้องอ้างแหล่งที่มาเป็นลิงก์ไปหน้าใน `sources/` เช่น `[[คู่มือตรวจสอบสิทธิ์สวัสดิการ]] ข้อ 7` ห้ามเติมจากความรู้ทั่วไปโดยไม่ระบุ
- `raw/pdf/` = ต้นฉบับ, `raw/text/` = ข้อความที่สกัด/ถอดจากภาพ (สแกนถอดโดย Claude มีหมายเหตุบรรทัดแรก) ใช้อ่านแทน PDF
- ชื่อไฟล์ใน raw ต้องสั้นพอ (ภาษาไทย 1 ตัว = 3 ไบต์ ชื่อไฟล์เกิน 255 ไบต์เครื่องมือหลายตัวเปิดไม่ได้)
- ข้อมูลขัดแย้งกัน: **ยึดเอกสารที่ออกล่าสุด** และหมายเหตุฉบับเก่าไว้ · ถ้าตัดสินจากวันที่ไม่ได้ (เอกสารไม่ระบุวันที่ หรือเป็นคู่มือสรุปที่ขัดกับระเบียบ/คำสั่งต้นฉบับ) ให้ยึดต้นฉบับ แล้วใส่ `> [!warning] ข้อมูลขัดแย้ง` เขียนทั้งสองแบบพร้อมแหล่ง
- ข้อมูลที่อาจล้าสมัย ระบุวันที่ของแหล่งข้อมูลเสมอ

## งานหลัก

### Ingest — เพิ่มเอกสารใหม่
1. อ่านไฟล์ใน `vault/raw/`
2. สร้าง `wiki/sources/<ชื่อเอกสาร>.md` สรุปเนื้อหา + ลิงก์ไปไฟล์ raw
3. สร้าง/อัปเดตหน้าที่เกี่ยวข้องใน `rights/`, `welfare/`, `agencies/`, `forms/`
4. อัปเดต `index.md` และ `overview.md` ถ้าภาพรวมเปลี่ยน
5. เพิ่มบรรทัดใน `log.md`: `## YYYY-MM-DD ingest | <ชื่อเอกสาร>` + รายการหน้าที่แตะ

### Query — ตอบคำถาม
อ่าน `index.md` ก่อน แล้วค่อยเปิดหน้าที่เกี่ยวข้อง ถ้าคำตอบมีคุณค่าใช้ซ้ำได้ ให้บันทึกเป็นหน้าใหม่ใน wiki

### Lint — ตรวจสุขภาพ wiki
หาหน้าที่ไม่มีลิงก์เข้า (orphan), ลิงก์เสีย, ข้อมูลขัดแย้ง, หน้าที่ไม่มีแหล่งอ้างอิง, หัวข้อที่ถูกพูดถึงแต่ยังไม่มีหน้า แล้วบันทึกผลใน `log.md`

## หนังสือ (ชั้นหนังสือหน้าแรก)

- รายชื่อเล่มและบท: `src/data/books.json` (เพิ่มเล่มใหม่ = เพิ่ม object ในอาร์เรย์)
- เนื้อหาแต่ละบท: `vault/books/<book id>/<เลขบท 2 หลัก>.md` (แก้ใน Obsidian ได้) — ไม่มีไฟล์ = บทนั้นแสดง "กำลังจัดทำ"
- Markdown ที่รองรับ: `##`/`###`/`####`, ย่อหน้า, `-` และ `1.` (ซ้อนด้วยเว้น 2 ช่อง), `| ตาราง |`, `> หมายเหตุ`, `**ตัวหนา**` (ตัวแปลง `scripts/lib/markdown.mjs`)
- รูปในบท: `![คำอธิบาย](../../raw/assets/ชื่อไฟล์.jpg)` ทั้งบรรทัด — ไฟล์ต้องอยู่ใน `vault/raw/assets/` (build คัดลอกไปที่ `docs/assets/raw/` ซึ่งเผยแพร่สาธารณะบน GitHub Pages)
- การ์ด "เกิดอะไรขึ้นกับคุณ?" หน้าแรก: `src/data/highlights.json` (ชี้ไป book + ch) · ตัวเลขบนการ์ดตรวจด้วย `facts.json` (location `highlight:<id>`)
- เล่มที่มี `"fromCategories": true` (เล่ม `welfare44` = คู่มือ 44 ข้อ) สร้างบทจาก `categories.json` ตอน build — บท = หมวด เนื้อหา = ข้อใน `clauses.json` (ไม่ต้องมีไฟล์ใน vault/books)
- บทที่ชี้ไปเล่มอื่นใช้ `link: { book, label, text }` (เช่น กฟน.1 บท 1 → เล่ม 44 ข้อ) · `tools` ที่ระดับเล่มหรือบท = ปุ่มไปหน้าเครื่องมือ
- หน้าอ่าน `book.html?book=<id>&ch=<n>&clause=<ข้อ>`: สารบัญเป็น sidebar เปลี่ยนบทในหน้าเดียว · ช่องค้นหาหน้าแรกค้นทุกเล่ม
- เล่ม `kfn1` = คู่มือตรวจสอบใบสำคัญจ่ายเงิน กฟน.1 (26 ม.ค. 2565) ถอดจาก PDF — ข้อความต้นฉบับสระอำหาย ต้องแก้ทีละบท · จุดที่มีระเบียบใหม่กว่าให้ใส่ `> หมายเหตุ` ไม่แก้ข้อความต้นฉบับ

## Chatbot & Google Sites Architecture

- **ข้อมูลกลาง (Single Source of Truth)**: เก็บใน `src/data/*.json` (ระเบียบ 44 ข้อ, หมวดหมู่, อัตราเบี้ยเลี้ยง/ที่พัก, wizard, ฟอร์ม)
- **Backend (Apps Script)**: อยู่ใน `apps-script/`
  - `Router.js`: `doGet` (bootstrap/version) + `doPost` (chat/feedback)
  - `Chat.js`: ประกอบ System Prompt ฝั่ง Server (คู่มือ 48 ข้อ + หน้า wiki ที่เกี่ยวกับคำถาม ≤ 20K ตัวอักษร เลือกด้วย bigram) พร้อม Exponential Backoff & Rate Limit — ทดสอบการเลือกหน้าด้วย `npm test`
  - `Feedback.js`: บันทึกลง Google Sheet พร้อมป้องกัน Formula Injection
  - `Quota.js`: จำกัดคำขอรวมทุกผู้ใช้ — แชต 14/นาที 240/วัน (Gemini free tier 15 RPM / 250 RPD) · feedback 10/นาที 100/วัน · ดูยอดวันนี้: รัน `showQuotaUsage` ใน editor · ทดสอบด้วย `npm test`
  - `Data.js` (generated): รวมจาก `src/data/` ผ่าน `npm run build`
  - `Knowledge.js` (generated): รวมจาก `vault/wiki/`
  - API key เก็บใน Script Properties ชื่อ `GEMINI_API_KEY`
- **Frontend (Google Sites Pages)**: อยู่ใน `src/sites/`
  - หน้าใน `src/sites/pages/`: `home` (ชั้นหนังสือ + ค้นหาทุกเล่ม), `book` (อ่านหนังสือ), `allowance`, `tools`, `tables`, `forms`, `chat`
  - คอมไพล์เป็น Embed code ก้อนเล็ก (30-45 KB) ใน `dist/sites/<page>.html` ด้วย `npm run build:sites`
  - ปรับ URL หน้าใน Sites ได้ที่ `src/sites/config.json`
- **คำสั่งสำคัญ**:
  - `npm run build` = รวม wiki (`Knowledge.js`) + src/data (`Data.js`) + ตรวจตัวเลขสำคัญให้ตรงกันทุกที่ตาม `src/data/facts.json` (build ล้มถ้าไม่ตรง)
  - `npm run build:sites` = บิลด์โค้ดฝัง Google Sites ไปที่ `dist/sites/*.html` (Tailwind สร้าง CSS ตอน build ตาม `tailwind.config.cjs` — ครั้งแรกต้อง `npm install`)
  - `npm run push` = build + `clasp push`
  - `npm run deploy` = build + push + อัปเดตเวอร์ชัน deployment บน Apps Script อัตโนมัติ
- **ปล่อยงานขึ้นจริง** = `npm run deploy` (ข้อมูล/แชต) + `npm run build:sites` แล้ว commit `docs/` และ `git push` (GitHub Pages) — Google Sites ผูก URL ของ GitHub Pages ไว้ จึงไม่ต้องวางโค้ดใน Sites ใหม่
