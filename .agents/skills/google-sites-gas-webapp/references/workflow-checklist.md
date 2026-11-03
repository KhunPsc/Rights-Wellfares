# Workflow & Deployment Checklist

เช็กลิสต์การเพิ่มหน้าใหม่ แก้ข้อมูล และ Deploy (หน้าเว็บโฮสต์บน GitHub Pages — Google Sites ฝัง URL ไว้)

---

## 1. เพิ่มหน้าใหม่ (Add New Page)

1. [ ] สร้าง `src/sites/pages/<page>.html` (บรรทัดแรก `<!-- @title ชื่อหน้า -->`) และ `<page>.js` ถ้ามี JavaScript
2. [ ] เพิ่ม `"<page>": "<page>.html"` ใน `pages` ของ `src/sites/config.json`
3. [ ] เพิ่มลิงก์ใน `src/sites/shared/nav.html` ทั้งเมนูจอใหญ่และเมนูมือถือ (`data-nav="<page>"` เพื่อไฮไลต์หน้าปัจจุบัน)
4. [ ] ลิงก์ภายในเว็บใช้ relative link แท็บเดิม (ปุ่มย้อนกลับใช้ได้) · สถานะที่ต้องจำข้ามหน้าเก็บทั้ง query string และ `localStorage` (Google Sites อาจตัด query string)
5. [ ] script จาก CDN ต้องระบุเวอร์ชันตายตัวและใส่ `integrity` (SRI) + `crossorigin="anonymous"`
6. [ ] `npm run build:sites` แล้ว commit `docs/` และ `git push` — ไม่ต้องแก้ Google Sites

---

## 2. แก้ข้อมูล (Update Data)

1. [ ] แก้ต้นทางใน `src/data/` / `vault/wiki/` / `vault/books/` (ดู HOW_TO_UPDATE.md ที่ root)
2. [ ] `npm test` และ `npm run build` (ล้มถ้าตัวเลขใน `facts.json`, `topics` หรือบทที่การ์ดชี้ไม่ตรง)
3. [ ] `npm.cmd run deploy` (ห้าม `npx clasp` — ชื่อโฟลเดอร์มี `&`)
4. [ ] ตรวจ `?action=version` ได้แฮชใหม่ — ผู้ที่เปิดเว็บอยู่จะได้ข้อมูลใหม่เองผ่าน stale-while-revalidate

---

## 3. เช็กลิสต์ความปลอดภัย (Security Audit)

- [ ] **API Key**: `GEMINI_API_KEY` อยู่ใน Script Properties เท่านั้น ส่งทาง header `x-goog-api-key` · pre-commit hook กัน secret
- [ ] **Git**: `.clasp.json`, `.clasprc.json`, `.env*`, `credentials*.json` อยู่ใน `.gitignore`
- [ ] **โควตา**: `takeQuota_()` (`Quota.js`) ถูกเรียกใน `Chat.js` (รวม retry) และ `Feedback.js`
- [ ] **Error**: ไม่ส่ง `err.toString()` หรือข้อความจาก Gemini กลับให้ผู้ใช้
- [ ] **Sanitization**: `cell_()` ใน `Feedback.js` กัน formula injection · หน้าเว็บ escape ข้อความผู้ใช้และคำตอบ AI ก่อน `innerHTML`
- [ ] **Iframe**: ไม่มี `target="_top"` · ลิงก์ดาวน์โหลดไฟล์ภายนอกใช้ `target="_blank" rel="noopener"`
