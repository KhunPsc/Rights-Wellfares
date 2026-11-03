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
│  - ฝัง URL ของ GitHub Pages (docs/) ด้วย Insert → Embed → By URL      │
│  - เปลี่ยนหน้าภายใน iframe เดียว (relative links, same tab)            │
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
│       │   ├── head.html        # Fonts (Prompt, Sarabun), FontAwesome (SRI) — Tailwind compile ตอน build
│       │   ├── ui.css           # สไตล์สากล, CSS Variables, Gradients
│       │   ├── core.js          # Client SDK: RW.loadData, RW.post, RW.go, Caching
│       │   ├── nav.html         # แถบนำทางด้านบน (ปุ่มย้อนกลับ, หน้าหลัก)
│       │   ├── chat-widget.html # ปุ่มลอย AI และหน้าต่าง Chat Drawer
│       │   ├── feedback-modal.html # Modal แบบฟอร์มแจ้งปัญหา/ข้อเสนอแนะ
│       │   └── footer.html      # แถบด้านล่าง
│       └── pages/               # หน้าเฉพาะแต่ละหน้า (.html + .js)
│           ├── home.html / home.js        # ชั้นหนังสือ + การ์ดเหตุการณ์ + ค้นหาทุกเล่ม
│           ├── book.html / book.js        # อ่านหนังสือ (สารบัญ sidebar)
│           ├── map.html / map.js          # แผนที่ความรู้ (force-graph)
│           ├── tables.html                # สรุปการใช้สิทธิ์
│           ├── forms.html / forms.js
│           ├── chat.html / chat.js
│           ├── allowance.html / allowance.js  # ไม่อยู่ในเมนู (ลิงก์จากบทหนังสือ)
│           └── tools.html / tools.js          # ซ่อนไว้ก่อน
│
├── scripts/                     # Build Automation Scripts (Node.js)
│   ├── build-knowledge.mjs      # vault/wiki → apps-script/Knowledge.js
│   ├── build-data.mjs           # src/data + vault/books + แผนที่ → apps-script/Data.js (ตรวจ facts.json)
│   ├── build-sites.mjs          # shared + pages → docs/*.html (Tailwind build-time)
│   └── test-*.mjs               # npm test
│
└── docs/                        # GitHub Pages (Settings → Pages → main /docs) — Google Sites ฝัง URL นี้
```

---

## 3. กฎเหล็กที่ห้ามลืม (Crucial Rules & Gotchas)

### กฎที่ 1: การนำทางในเว็บแอป (Single-Host Same-Tab Navigation)
* **เมื่อใช้ GitHub Pages เป็นโฮสต์หลัก (แนะนำสูงสุด)**:
  - ทุกลิงก์นำทางระหว่างหน้าภายในเว็บแอป (`home.html`, `book.html`, `map.html`, `tables.html`, `forms.html`, `chat.html`) ให้ใช้ **Relative Links** พร้อมการนำทางในแท็บเดิม (`target="_self"` หรือ `window.location.href`)
  - **ข้อดี:** ผู้ใช้สลับหน้าไป-มาได้ลื่นไหล ไม่ต้องเปิดแท็บใหม่ และปุ่มย้อนกลับ (Back) ของเบราว์เซอร์ทำงานได้ปกติ
  - **การฝังใน Google Sites:** ให้ฝังลิงก์หลัก `https://<user>.github.io/<repo>/` เพียงจุดเดียวใน Google Sites โดยการคลิกเปลี่ยนหน้าทั้งหมดจะทำงานอยู่ภายในกรอบ iframe เดิมอย่างราบรื่น
* **ลิงก์ดาวน์โหลดภายนอก (Direct Download)**:
  - ไฟล์ PDF หรือ Word ที่ดาวน์โหลดจาก Google Drive ให้คง `target="_blank" rel="noopener"` ไว้เพื่อให้เบราว์เซอร์เปิดดาวน์โหลดไฟล์ได้ทันที

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
* ฝั่ง Apps Script ต้องคุมโควตารวม (`apps-script/Quota.js`: ตัวนับต่อนาทีใน `CacheService` + ต่อวันใน Script Properties + `LockService`) — Gemini free tier 15 RPM / 250 RPD / 250K TPM และคำถามละ ~25K token จึงตั้งแชต 9/นาที 240/วัน
* ส่ง API key ทาง header `x-goog-api-key` (ไม่ใส่ใน URL) และไม่ส่ง error ภายในกลับให้ผู้ใช้
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

### ขั้นตอนที่ 4: บิลด์ Frontend และขึ้น GitHub Pages
```bash
npm run build:sites      # src/sites → docs/*.html
git add -A && git commit -m "..." && git push
```

### ขั้นตอนที่ 5: ฝังใน Google Sites (ทำครั้งเดียว)
1. GitHub: **Settings → Pages → Deploy from a branch → main / docs**
2. Google Sites: **แทรก → ฝัง → ด้วย URL** วาง `https://<username>.github.io/<repo>/` แล้วเลือก "ทั้งหน้า"
3. หลังจากนี้ `git push` แล้ว Sites อัปเดตเอง ไม่ต้องวางโค้ดใหม่

---

## 5. เอกสารอ้างอิงเพิ่มเติม (References)
* [Iframe Sandbox & Cross-Page Navigation](./references/iframe-sandbox.md)
* [Caching & CORS Bypass](./references/caching-and-cors.md)
* [Security, AI Proxy & Sheets Protection](./references/security-and-ai-proxy.md)
* [Checklist ก่อนขึ้น Production](./references/workflow-checklist.md)
