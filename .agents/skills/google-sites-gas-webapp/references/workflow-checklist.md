# Workflow & Deployment Checklist

เช็กลิสต์ขั้นตอนการพัฒนา เพิ่มหน้าใหม่ และ Deploy ระบบ Multi-Page Google Sites + GAS Web App

---

## 1. เพิ่มหน้าใหม่ใน Google Sites (Add New Page)

1. [ ] **สร้างหน้าใน Google Sites**:
   - สร้างหน้าใหม่ใน Google Sites (เช่น `https://sites.google.com/view/mysite/new-page`)
2. [ ] **อัปเดต URL ใน `src/sites/config.json`**:
   - เพิ่มชื่อหน้าและ URL ในหัวข้อ `pages`:
     ```json
     "pages": {
       "newPage": "https://sites.google.com/view/mysite/new-page"
     }
     ```
3. [ ] **สร้างไฟล์หน้าใน `src/sites/pages/`**:
   - สร้าง `newPage.html` (ใส่ `<!-- @title ชื่อหน้า -->` บรรทัดแรก)
   - สร้าง `newPage.js` (ถ้ามีการทำงานของ JavaScript)
4. [ ] **ตรวจสอบลิงก์ทุกจุดในหน้านั้น**:
   - ลิงก์ข้ามหน้าต้องมี `target="_blank" rel="noopener"` เสมอ
   - ห้ามใช้ `target="_top"` เด็ดขาด
5. [ ] **รันคำสั่ง Build**:
   ```bash
   npm run build:sites
   ```
6. [ ] **นำโค้ดไปฝังใน Google Sites**:
   - เปิดไฟล์ `dist/sites/newPage.html` คัดลอกโค้ดทั้งหมด
   - วางลงในกล่อง Embed (ฝังโค้ด) บนหน้า Google Sites แล้วกด Publish

---

## 2. แก้ไขข้อมูลระเบียบ / ตาราง / เอกสาร (Update Data)

1. [ ] แก้ไขไฟล์ JSON ใน `src/data/` (เช่น `clauses.json`, `forms.json`)
2. [ ] รันคำสั่งรวมข้อมูล:
   ```bash
   npm run build
   ```
   *(สคริปต์จะรวมข้อมูลเข้า `apps-script/Data.js` พร้อมแฮชเวอร์ชันใหม่)*
3. [ ] ส่งโค้ดขึ้น Apps Script:
   ```bash
   clasp push
   # หรือ deploy เวอร์ชั่นใหม่
   npm run deploy
   ```
4. [ ] ตรวจสอบว่า `doGet?action=version` ส่งแฮชใหม่กลับมา
5. [ ] ผู้ใช้งานที่เปิดหน้าเว็บอยู่จะได้รับข้อมูลใหม่โดยอัตโนมัติผ่าน Stale-While-Revalidate

---

## 3. เช็กลิสต์ความปลอดภัยก่อนนำขึ้น Production (Security Audit)

- [ ] **API Key**: `GEMINI_API_KEY` ถูกเก็บใน Script Properties ของ Apps Script เท่านั้น (ไม่ปรากฏในโค้ด git)
- [ ] **Git Tracking**: ตรวจสอบว่า `.clasp.json`, `.clasprc.json`, `.env` อยู่ใน `.gitignore`
- [ ] **Rate Limiting**: มีการเปิดใช้ `throttleGemini_()` ใน `Chat.js` ป้องกันการยิงสแปม
- [ ] **Input Sanitization**: มีการใช้ `sanitizeCell_()` ใน `Feedback.js` ป้องกัน Formula Injection
- [ ] **Iframe Sandbox**: ไม่มี `target="_top"` หลงเหลืออยู่ในไฟล์ HTML/JS ใดๆ
- [ ] **Direct Download**: ลิงก์ดาวน์โหลดเอกสารใช้รูปแบบ `/uc?export=download` หรือ `/export?format=docx` พร้อม `target="_blank"`
