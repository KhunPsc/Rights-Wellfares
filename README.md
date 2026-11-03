# Rights & Welfares — สิทธิและสวัสดิการ กฟภ. (PEA N1)

ห้องสมุดคู่มือสวัสดิการออนไลน์ + AI ผู้ช่วยตอบคำถาม สำหรับพนักงานและลูกจ้าง กฟภ.

| ส่วน | อยู่ที่ | ทำอะไร |
|---|---|---|
| ฐานความรู้ (wiki) | [vault/](vault/) | Obsidian vault ดูแลด้วย LLM ตามกฎใน [CLAUDE.md](CLAUDE.md) — ใช้เป็นความรู้ของแชตบอทและแผนที่ความรู้ |
| หนังสือ | [vault/books/](vault/books/) + [src/data/books.json](src/data/books.json) | เนื้อหาแต่ละบท (Markdown) ของเล่มบนชั้นหนังสือ |
| ข้อมูลกลาง | [src/data/](src/data/) | คู่มือ 44 ข้อ อัตราเบี้ยเลี้ยง แบบฟอร์ม ข่าว การ์ดหน้าแรก ฯลฯ |
| Backend | [apps-script/](apps-script/) | Google Apps Script web app: ส่งข้อมูลให้หน้าเว็บ, แชตบอท (Gemini), รับ Feedback ลง Google Sheet |
| หน้าเว็บ | [src/sites/](src/sites/) → [docs/](docs/) | build เป็น GitHub Pages (`https://khunpsc.github.io/Rights-Wellfares/`) — Google Sites ฝัง URL นี้ไว้ |

หน้าเว็บ: ชั้นหนังสือ (หน้าแรก) · อ่านหนังสือ · แผนที่ความรู้ · สรุปการใช้สิทธิ์ · แบบฟอร์ม · แชต AI
(หน้าโปรแกรมคำนวณ `tools` ยังซ่อนจากเมนู)

## ติดตั้งครั้งแรก

```powershell
npm install                      # Tailwind สำหรับ build หน้าเว็บ
npm install -g @google/clasp     # ต้องติดตั้งแบบ global — ชื่อโฟลเดอร์มี & ทำให้ npx/clasp ในโปรเจกต์ใช้ไม่ได้บน Windows
clasp login
```

- ผูกกับโปรเจกต์ Apps Script: คัดลอก `.clasp.json.example` เป็น `.clasp.json`
- ตั้ง API key: Apps Script editor → Project Settings → Script Properties → `GEMINI_API_KEY` (ห้ามใส่ key ในโค้ด — มี pre-commit hook กันไว้)

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm test` | ทดสอบการเลือกหน้า wiki ของแชตบอท, ตัวแปลง Markdown, โควตา, แผนที่ความรู้ |
| `npm run build` | รวม wiki → `apps-script/Knowledge.js` และ `src/data` + หนังสือ + แผนที่ → `apps-script/Data.js` · ตรวจตัวเลขสำคัญตาม `src/data/facts.json` (ไม่ตรง = build ล้ม) |
| `npm run build:sites` | build หน้าเว็บลง `docs/` (Tailwind สร้าง CSS ตอน build) |
| `npm run deploy` | build + `clasp push` + อัปเดต deployment เดิม (URL `/exec` ไม่เปลี่ยน) |

PowerShell บนเครื่องนี้บล็อก `npm.ps1` — ใช้ `npm.cmd run deploy` แทน

## ปล่อยงานขึ้นระบบ

1. `npm run deploy` — ข้อมูล หนังสือ แผนที่ และแชตบอท (ทุกอย่างที่มาจาก Apps Script)
2. `npm run build:sites` แล้ว commit `docs/` และ `git push` — หน้าเว็บ (GitHub Pages อัปเดตใน ~1–2 นาที)

ขั้นตอนเพิ่ม/แก้เนื้อหาแบบละเอียด: [HOW_TO_UPDATE.md](HOW_TO_UPDATE.md)

## ข้อจำกัดที่ควรรู้

- แชตบอทใช้ Gemini free tier — จำกัดรวมทุกผู้ใช้ 9 คำถาม/นาที 240 คำถาม/วัน (`apps-script/Quota.js`) · Feedback 10/นาที 100/วัน
- `docs/` เผยแพร่สาธารณะ — รวมรูปใน `vault/raw/assets/` ที่หนังสือใช้
- PDF ต้นฉบับ (`vault/raw/pdf/`) เก็บในเครื่องเท่านั้น ไม่ขึ้น git
