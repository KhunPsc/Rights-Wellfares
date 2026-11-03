---
name: rights-welfare-content-update
description: >-
  Standard operating procedure for adding or updating content in the PEA Rights & Welfare platform:
  Obsidian wiki (vault/wiki), book chapters (vault/books + src/data/books.json), JSON data (clauses, categories,
  news, highlights, facts), the Apps Script backend (Data.js / Knowledge.js) and the GitHub Pages frontend (docs/).
  Use this skill whenever adding new welfare regulations, circular letters (หนังสือเวียน), guidelines, book chapters,
  news, or changing key rates.
---

# Rights & Welfare Platform: Content Update SOP

ขั้นตอนละเอียดอยู่ใน [HOW_TO_UPDATE.md](../../../HOW_TO_UPDATE.md) และกฎการเขียน wiki อยู่ใน [CLAUDE.md](../../../CLAUDE.md) — อ่านทั้งสองไฟล์ก่อนแก้เนื้อหา ไฟล์นี้สรุปสิ่งที่ต้องไม่พลาด

## แหล่งข้อมูล (แก้ที่ต้นทางเท่านั้น)

| เนื้อหา | ต้นทาง | ห้ามแก้ (generated) |
|---|---|---|
| ฐานความรู้แชตบอท + แผนที่ความรู้ | `vault/wiki/**` (+ `index.md` คำอธิบายหนึ่งบรรทัด) | `apps-script/Knowledge.js` |
| หนังสือ | `src/data/books.json` + `vault/books/<id>/<NN>.md` | `apps-script/Data.js` |
| คู่มือ 44 ข้อ (เล่ม `welfare44`) | `src/data/clauses.json` + `categories.json` | `apps-script/Data.js` |
| ข่าว / การ์ดหน้าแรก / ตัวเลขสำคัญ | `news.json` / `highlights.json` / `facts.json` | `apps-script/Data.js` |
| หน้าเว็บ | `src/sites/**` | `docs/*.html` |

## กฎที่ต้องไม่พลาด

1. ทุกข้อเท็จจริงใน wiki อ้าง `[[หน้าใน sources/]]` · ข้อมูลขัดแย้งยึดเอกสารล่าสุดและเก็บฉบับเก่าเป็นหมายเหตุ
2. เปลี่ยนอัตราเงิน → แก้ `facts.json` ก่อน แล้ว `npm run build` จะบอกทุกจุดที่ต้องแก้
3. บทหนังสือที่เกี่ยวกับหัวข้อ wiki ต้องมี `topics` (ชื่อไฟล์หน้า wiki) — build ล้มถ้าอ้างหน้าที่ไม่มี
4. รูปในบทหนังสือต้องอยู่ใน `vault/raw/assets/` (เผยแพร่สาธารณะผ่าน `docs/assets/raw/`)
5. หนังสือ กฟน.1 ถอดจาก PDF ฉบับ ม.ค. 2565 — จุดที่มีระเบียบใหม่กว่าให้ใส่ `> หมายเหตุ` ไม่แก้ข้อความต้นฉบับ
6. ห้ามใส่ API key ในโค้ด · ห้ามใช้ `npx clasp` (ชื่อโฟลเดอร์มี `&`)

## ลำดับการทำงาน

```powershell
npm test
npm run build            # ล้ม = มีตัวเลข/topics/บทที่ไม่ตรง ให้แก้ตามที่แจ้ง
npm.cmd run deploy       # ข้อมูลจาก Apps Script (หนังสือ ข่าว แผนที่ แชตบอท)
npm run build:sites      # ถ้าแก้ src/sites หรือรูปในหนังสือ
git add -A; git commit; git push
```

## ตรวจหลังปล่อยงาน

- หน้าแรก: ข่าว, การ์ดเหตุการณ์, ชั้นหนังสือ, ช่องค้นหา
- หนังสือ: บทใหม่ + ปุ่ม "ดูในแผนที่ความรู้"
- แผนที่ความรู้: จุดใหม่ + ปุ่มไปบทหนังสือ
- แชต AI: ถามเรื่องใหม่ (เช่น "เบิกปากกาลดน้ำหนักได้ไหม") แล้วตอบถูก
