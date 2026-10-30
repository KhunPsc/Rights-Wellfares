# Rights & Welfares

ฐานความรู้เรื่องสิทธิและสวัสดิการ + chatbot ตอบคำถาม

- **Wiki:** Obsidian vault ใน [vault/](vault/) ดูแลด้วย LLM ตามกฎใน [CLAUDE.md](CLAUDE.md)
- **Chatbot:** Google Apps Script web app ใน [apps-script/](apps-script/) ใช้ Claude ตอบโดยอิงเนื้อหา wiki
- **เว็บไซต์:** Google Sites ฝัง chatbot ผ่าน Insert → Embed

## ติดตั้งครั้งแรก

```bash
npm install
npx clasp login
```

ผูกกับโปรเจกต์ Apps Script:

- สร้างใหม่: `npx clasp create --type webapp --title "Rights & Welfares Chatbot" --rootDir apps-script`
- หรือใช้ของเดิม: คัดลอก `.clasp.json.example` เป็น `.clasp.json` แล้วใส่ `scriptId`

ตั้ง API key: เปิด Apps Script editor → Project Settings → Script Properties → เพิ่ม `ANTHROPIC_API_KEY`

## ใช้งาน

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run build` | รวม `vault/wiki/` เป็น `apps-script/Knowledge.js` |
| `npm run push` | build แล้ว push โค้ดขึ้น Apps Script |
| `npm run deploy` | สร้าง deployment ใหม่ของ web app |

## ฝังใน Google Sites

1. Apps Script editor → Deploy → New deployment → Web app
   - Execute as: **Me** · Who has access: **Anyone**
2. คัดลอก URL ที่ลงท้าย `/exec`
3. Google Sites → Insert → Embed → By URL → วาง URL

## เพิ่มความรู้

วางเอกสารใน `vault/raw/` แล้วสั่ง Claude Code ว่า "ingest ไฟล์ ..." จากนั้น `npm run push`
