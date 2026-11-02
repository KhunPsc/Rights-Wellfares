---
name: google-sites-gas-webapp
description: >-
  Architecture and development guide for building fast, maintainable multi-page Google Sites
  applications backed by Google Apps Script (GAS) Web App as a secure headless API.
  Use this skill when designing, refactoring, building, or deploying applications embedded
  inside Google Sites with Google Apps Script (Gemini AI proxy, Google Sheets logging,
  single-source data bootstrap, and Google Sites iframe sandbox handling).
---

# Multi-Page Google Sites + Google Apps Script (GAS) Architecture

คู่มือมาตรฐานและขั้นตอนปฏิบัติ (Standard Workflow & Architecture) สำหรับการพัฒนาเว็บแอปพลิเคชันแบบหลายหน้าบน **Google Sites** โดยใช้ **Google Apps Script (GAS)** ทำหน้าที่เป็น Headless API Server หลังบ้าน รองรับฟังก์ชันขั้นสูง เช่น Chatbot AI (Gemini), ระบบแจ้งปัญหา/บันทึกลง Google Sheet, และระบบดาวน์โหลดเอกสาร

---

## 1. ภาพรวมสถาปัตยกรรม (System Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Google Sites (Frontend)                         │
│  - เมนูหลักของ Google Sites (หน้าแรก, คู่มือ, เบี้ยเลี้ยง, คำนวณ, ...)           │
│  - แต่ละหน้าฝัง HTML ขนาดเล็ก (30-70 KB) จาก dist/sites/<page>.html     │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 │ fetch GET (bootstrap/version)         │ fetch POST (text/plain)
                 ▼                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Google Apps Script Web App (/exec)                   │
│                                                                        │
│  ┌────────────────────── Router.js (doGet / doPost) ─────────────────┐  │
│  │                                                                   │  │
│  │  [doGet]                                                          │  │
│  │  ├─ action=bootstrap ──> ส่งข้อมูล JSON ทั้งหมด + version hash     │  │
│  │  └─ action=version   ──> เช็กเวอร์ชันเบื้องหลัง (stale-while-revalidate)│
│  │                                                                   │  │
│  │  [doPost]                                                         │  │
│  │  ├─ action=chat      ──> Chat.js (Gemini AI Proxy + Rate Limit)   │  │
│  │  └─ action=feedback  ──> Feedback.js (บันทึกลง Google Sheet)       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
       Google Gemini API (AI Chat)         Google Sheets (Feedback DB)
```

### จุดเด่นของสถาปัตยกรรมนี้
1. **แก้ปัญหาความอืดของหน้าเว็บขนาดใหญ่ (Monolithic Bloat)**: แยกหน้าย่อยเป็น embed แต่ละหน้า ทำให้โหลดไว ไม่ค้าง
2. **Single Source of Truth**: ข้อมูลระเบียบ, ตาราง, และแบบฟอร์มอยู่ที่ `src/data/*.json` ที่เดียว
3. **ความปลอดภัยสูง (Zero Leakage)**:
   - `GEMINI_API_KEY` เก็บใน `ScriptProperties` ของ Apps Script ไม่หลุดมาฝั่ง Client
   - System Prompt สังเคราะห์ฝั่ง Server Client ไม่สามารถขโมยหรือเปลี่ยน Prompt ได้
   - ป้องกัน Formula Injection ในฟอร์ม Feedback ก่อนบันทึกลง Google Sheets
4. **Offline / Stale-While-Revalidate Caching**: ฝั่ง Client แคชข้อมูลลง `localStorage` โหลดหน้าขึ้นทันทีใน 0 วินาที แล้วเช็กเวอร์ชันใหม่เบื้องหลัง

---

## 2. โครงสร้างโฟลเดอร์มาตรฐาน (Project Structure)

```text
├── apps-script/                 # Backend: โค้ด Google Apps Script (Deploy ผ่าน clasp)
│   ├── Router.js                # จัดการ doGet / doPost และ Route คำขอ
│   ├── Chat.js                  # Proxy คุยกับ Gemini API, ควบคุม Prompt & Rate Limit
│   ├── Feedback.js              # บันทึกข้อมูลลง Google Sheet + กัน Formula Injection
│   ├── Data.js                  # (Generated) รวม JSON จาก src/data/ เป็นตัวแปรใน GAS
│   └── Knowledge.js             # (Generated) เอกสารอ้างอิง/ฐานความรู้เพิ่มเติม
│
├── src/
│   ├── data/                    # Single Source of Truth (ข้อมูลกลางของระบบ)
│   │   ├── categories.json      # หมวดหมู่เนื้อหา
│   │   ├── clauses.json         # ข้อระเบียบ / มาตราต่างๆ
│   │   ├── allowance-rates.json # อัตราเบี้ยเลี้ยง / ค่าใช้จ่าย
│   │   ├── forms.json           # รายการเอกสารดาวน์โหลด (PDF/Docx/Direct Link)
│   │   └── chat-prompt.md       # คำสั่ง System Prompt หลักของ AI
│   │
│   └── sites/                   # Frontend: โค้ดสำหรับคอมไพล์ลง Google Sites
│       ├── config.json          # กำหนด apiUrl และ URL หน้าต่างๆ ใน Google Sites
│       ├── shared/              # คอมโพเนนต์ที่ใช้ร่วมกันทุกหน้า (Inlined ตอน build)
│       │   ├── head.html        # CDN Tailwind, Fonts (Prompt, Sarabun), FontAwesome
│       │   ├── ui.css           # สไตล์สากล, CSS Variables, Gradients
│       │   ├── core.js          # Client SDK: RW.loadData, RW.post, RW.go, Caching
│       │   ├── nav.html         # แถบนำทางด้านบน (ปุ่มย้อนกลับ, หน้าหลัก)
│       │   ├── chat-widget.html # ปุ่มลอย AI และหน้าต่าง Chat Drawer
│       │   ├── feedback-modal.html # Modal แบบฟอร์มแจ้งปัญหา/ข้อเสนอแนะ
│       │   └── footer.html      # แถบด้านล่าง
│       └── pages/               # หน้าเฉพาะแต่ละหน้า (.html + .js)
│           ├── home.html / home.js
│           ├── manual.html / manual.js
│           ├── allowance.html / allowance.js
│           ├── tools.html / tools.js
│           ├── tables.html
│           ├── forms.html / forms.js
│           └── chat.html / chat.js
│
├── scripts/                     # Build Automation Scripts (Node.js)
│   ├── build-data.mjs           # แปลง src/data/* → apps-script/Data.js
│   └── build-sites.mjs          # รวม shared + pages → dist/sites/*.html
│
└── dist/sites/                  # ผลลัพธ์พร้อมใช้งาน (นำโค้ดในนี้ไปฝังใน Google Sites)
    ├── home.html
    ├── manual.html
    ├── allowance.html
    ├── tools.html
    ├── tables.html
    ├── forms.html
    └── chat.html
```

---

## 3. กฎเหล็กที่ห้ามลืม (Crucial Rules & Gotchas)

### กฎที่ 1: Google Sites Iframe Sandbox (เปิดหน้าต่างใหม่เสมอ)
* Google Sites ครอบกล่อง Embed ด้วย Sandbox ที่ **ไม่อนุญาต `allow-top-navigation`**
* **ข้อห้ามเด็ดขาด**: ห้ามใช้ `target="_top"` หรือ `target="_parent"` หรือ `window.open(url, '_top')` ใน Embed
* **ข้อกำหนด**: ลิงก์ข้ามหน้าและการดาวน์โหลดทั้งหมดใน Embed ต้องใช้ **`target="_blank" rel="noopener"`**
* ดูรายละเอียดใน [references/iframe-sandbox.md](./references/iframe-sandbox.md)

### กฎที่ 2: เลี่ยง CORS Preflight ด้วย `Content-Type: text/plain`
* Google Apps Script Web App **ไม่รองรับ HTTP `OPTIONS` (Preflight)** สำหรับคำขอแบบ Simple CORS
* เมื่อทำคำขอ `POST` จากเบราว์เซอร์ไปที่ Apps Script ต้องส่ง Header เป็น:
  ```javascript
  headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  ```
  และใช้ `JSON.parse(e.postData.contents)` ในฝั่ง Apps Script เพื่อป้องกันปัญหา CORS Preflight ล้มเหลว

### กฎที่ 3: Caching ด้วย Stale-While-Revalidate
* ห้ามยิงเรียกข้อมูลทั้งหมดทุกครั้งที่เปลี่ยนหน้า
* ใช้ `RW.loadData(cb)`:
  1. ดึงข้อมูลจาก `localStorage` ขึ้นมาเรนเดอร์หน้าทันที (0 ms)
  2. ส่งคำขอเบาๆ ไปถาม `?action=version`
  3. ถ้าพบว่าเวอร์ชันบนเซิร์ฟเวอร์ใหม่กว่า ค่อยดึง `?action=bootstrap` มาเรนเดอร์ซ้ำและอัปเดตแคช

### กฎที่ 4: ความปลอดภัยของ AI & Form Input
* ห้ามส่ง API Key หรือกำหนด System Prompt จาก Client เด็ดขาด
* ฝั่ง Apps Script ต้องคุม Rate Limit (เช่น 15 คำขอ/นาที ผ่าน `CacheService`)
* ป้องกัน Formula Injection ใน Google Sheet: ถ้าค่าที่กรอกขึ้นต้นด้วย `=`, `+`, `-`, `@` ให้เติมเครื่องหมาย `'` นำหน้าเสมอ

---

## 4. ขั้นตอนการพัฒนาและการ Deploy (Step-by-Step Workflow)

### ขั้นตอนที่ 1: เตรียมข้อมูลกลาง (`src/data/`)
1. กำหนดข้อมูลใน `categories.json`, `clauses.json`, `forms.json`
2. กำหนด System Prompt ของ AI ใน `chat-prompt.md`

### ขั้นตอนที่ 2: บิลด์ข้อมูลเข้า Backend
รันคำสั่ง:
```bash
npm run build
```
สคริปต์ `scripts/build-data.mjs` จะนำข้อมูลจาก `src/data/` ไปรวมเป็น `apps-script/Data.js` พร้อมสร้าง `DATA_VERSION` แฮชให้อัตโนมัติ

### ขั้นตอนที่ 3: Deploy Backend ด้วย Clasp
```bash
# ส่งโค้ดขึ้น Apps Script
clasp push

# หรือ Deploy อัปเดตเวอร์ชัน Web App อัตโนมัติ
npm run deploy
```
* หมายเหตุ: ใน Apps Script ให้ตั้งค่า Script Properties:
  - `GEMINI_API_KEY`: API Key จาก Google AI Studio
  - `FEEDBACK_SHEET_ID`: (ถ้าต้องการแยก Sheet) หรือให้สคริปต์สร้างแท็บชีตอัตโนมัติ

### ขั้นตอนที่ 4: บิลด์ Frontend สำหรับ Google Sites
1. ตรวจสอบ URL ของแต่ละหน้าที่สร้างบน Google Sites ใน `src/sites/config.json`
2. รันคำสั่งบิลด์:
   ```bash
   npm run build:sites
   ```
3. สคริปต์จะรวม CSS, JavaScript, Header, Nav, Floating Chatbot และ Feedback Modal เข้าไปในแต่ละหน้าใน `dist/sites/*.html`

### ขั้นตอนที่ 5: นำโค้ดไปวางใน Google Sites
1. ไปที่หน้า Google Sites ที่ต้องการ
2. เมนูด้านขวาเลือก **แทรก (Insert)** -> **ฝัง (Embed)** -> เลือกแท็บ **ฝังโค้ด (Embed code)**
3. เปิดไฟล์ที่ตรงกันใน `dist/sites/<page>.html` คัดลอกโค้ดทั้งหมด (Ctrl+A -> Ctrl+C) แล้ววาง
4. ขยายกล่อง Embed ให้พอดีกับหน้าจอ แล้วกด **เผยแพร่ (Publish)**

---

## 5. เอกสารอ้างอิงเพิ่มเติม (References)
* [Iframe Sandbox & Cross-Page Navigation](./references/iframe-sandbox.md)
* [Caching & CORS Bypass](./references/caching-and-cors.md)
* [Security, AI Proxy & Sheets Protection](./references/security-and-ai-proxy.md)
* [Checklist ก่อนขึ้น Production](./references/workflow-checklist.md)
