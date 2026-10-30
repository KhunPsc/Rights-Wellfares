# Rights & Welfares

ฐานความรู้เรื่องสิทธิและสวัสดิการ + chatbot ตอบคำถาม

- **Wiki:** Obsidian vault ใน [vault/](vault/) ดูแลด้วย LLM ตามกฎใน [CLAUDE.md](CLAUDE.md)
- **Chatbot:** Google Apps Script web app ใน [apps-script/](apps-script/) ใช้ Claude ตอบโดยอิงเนื้อหา wiki
- **เว็บไซต์:** Google Sites ฝัง chatbot ผ่าน Insert → Embed

## ติดตั้งครั้งแรก

ติดตั้ง clasp แบบ global (ชื่อโฟลเดอร์มี `&` ทำให้ติดตั้งในโปรเจกต์บน Windows ไม่ได้):

```bash
npm install -g @google/clasp
clasp login
```

ผูกกับโปรเจกต์ Apps Script: คัดลอก `.clasp.json.example` เป็น `.clasp.json` (scriptId ของโปรเจกต์ "คู่มือรักษาพยาบาล")

ตั้ง API key: Apps Script editor → Project Settings → Script Properties → `GEMINI_API_KEY`

## ใช้งาน

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run build` | รวม `vault/wiki/` เป็น `apps-script/Knowledge.js` |
| `npm run push` | build แล้ว push โค้ดขึ้น Apps Script (ทับทั้งโปรเจกต์) |
| `npm run deploy` | อัปเดต deployment เดิม — URL `/exec` ที่หน้าเว็บใช้อยู่ไม่เปลี่ยน |

## หน้าเว็บ (Google Sites)

ทั้งหน้าเป็น HTML ก้อนเดียวในกล่อง Embed code สำเนาอยู่ที่ `vault/raw/google-site/site-embed.html`
หน้าเว็บเรียก Apps Script ผ่าน `DEFAULT_GAS_PROXY_URL` (ถามแชท + ส่ง Feedback ลง Google Sheet)

## เพิ่มความรู้

วางเอกสารใน `vault/raw/` แล้วสั่ง Claude Code ว่า "ingest ไฟล์ ..." จากนั้น `npm run push`
