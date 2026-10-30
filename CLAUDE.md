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
- ข้อมูลขัดแย้งกัน: เขียนทั้งสองแบบ ระบุแหล่ง แล้วใส่ `> [!warning] ข้อมูลขัดแย้ง`
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

## Chatbot

- หน้าเว็บ: HTML ก้อนเดียวใน Google Sites (Embed code) สำเนาอยู่ที่ `vault/raw/google-site/site-embed.html`
  หน้าเว็บสร้าง system prompt จากข้อมูลในหน้าเอง แล้ว POST ไปที่ Apps Script
- `apps-script/รหัส.js`: `doPost` เป็น proxy ไป Gemini + บันทึก Feedback ลง Google Sheet
- API key เก็บใน Script Properties ชื่อ `GEMINI_API_KEY` ห้ามใส่ในโค้ด ห้าม commit
- `npm run build` สร้าง `apps-script/Knowledge.js` จาก `vault/wiki/` (ไฟล์ generated ห้ามแก้มือ, ยังไม่ได้ต่อเข้า doPost)
- `npm run push` = build + `clasp push` (ทับโค้ดบน Apps Script ทั้งโปรเจกต์) แล้วต้อง Deploy → Manage deployments → อัปเดตเวอร์ชันเพื่อให้ URL `/exec` เดิมใช้โค้ดใหม่
