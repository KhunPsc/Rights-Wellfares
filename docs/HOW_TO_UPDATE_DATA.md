# คู่มือและขั้นตอนการเพิ่มข้อมูลใหม่ในระบบ (Data & Content Update Guide)

เอกสารนี้รวบรวมขั้นตอนปฏิบัติในการเพิ่มหรือปรับปรุงข้อมูลระเบียบ สิทธิประโยชน์ หนังสือเวียน และข่าวสารประชาสัมพันธ์ของระบบ **สิทธิประโยชน์และสวัสดิการ PEA**

---

## สรุปภาพรวมสถาปัตยกรรมข้อมูล

ระบบนี้ใช้หลักการ **Single Source of Truth** ร่วมกับ **Multi-Target Deployment**:
1. **แหล่งความรู้ (Obsidian Vault):** อยู่ที่โฟลเดอร์ `vault/wiki/` ใช้บันทึกและจัดการความรู้แบบ Markdown
2. **ฐานข้อมูลระบบ (JSON Data):** อยู่ที่ `src/data/` (`clauses.json`, `categories.json`, `news.json`, `allowance-rates.json`, `forms.json`)
3. **Backend (Google Apps Script):** คอมไพล์จาก JSON เข้าสู่ `apps-script/Data.js` และ `apps-script/Knowledge.js` ผ่านสคริปต์ Node.js
4. **Frontend (GitHub Pages & Google Sites Embed):** คอมไพล์จาก `src/sites/` ไปยัง `dist/sites/` (สำหรับฝังใน Google Sites) และ `docs/` (สำหรับ GitHub Pages)

---

## ขั้นตอนการทำงาน 5 ขั้นตอน (Standard 5-Step Workflow)

### 1. บันทึกข้อมูลเข้าสู่ Obsidian Vault
- สร้างไฟล์บันทึกต้นฉบับไว้ที่ `vault/wiki/sources/<ชื่อเอกสารหรือเลขที่หนังสือ>.md`
- ลิงก์เชื่อมโยงไปยังหัวข้อสวัสดิการที่เกี่ยวข้องใน `vault/wiki/welfare/<ชื่อเรื่อง>.md`

### 2. ปรับปรุงข้อมูลใน `src/data/`
- **คู่มือระเบียบ/แนวทางปฏิบัติ (`clauses.json`):**
  - **หากเป็นข้อระเบียบปกติ:** ใช้เลขข้อเป็นตัวเลข เช่น `"num": 45`
  - **หากเป็นหลักเกณฑ์/หนังสือเวียนที่ไม่มีเลขข้อ:**
    - กำหนด `"num": "<string-id>"` (เช่น `"guidelines-weight-loss-pen"`)
    - กำหนด `"noNum": true` (เพื่อให้หน้าเว็บแสดงเป็นป้าย **"แนวทาง"** แทนที่จะแสดงเลขข้อ)
    - กำหนด `"cat": "cat-guidelines"` หรือหมวดหมู่ที่ต้องการ
- **หมวดหมู่ (`categories.json`):**
  - หากสร้างหมวดหมู่ใหม่ ให้เพิ่ม Object พร้อม `id`, `name`, `icon`, และรายการ `clauses`
- **ข่าวสาร/แถบวิ่ง/ป๊อปอัป (`news.json`):**
  - เพิ่มข่าวใหม่ในรายการ `news`
  - กำหนด `"urgent": true` หากต้องการให้ป๊อปอัป Modal เด้งขึ้นมาต้อนรับผู้ใช้งานในหน้าแรก (เด้ง 1 ครั้งต่อเซสชัน)
  - กำหนด `"targetPage": "manual.html"` และ `"targetNum": "<string-id หรือ num>"` สำหรับปุ่มกดไปอ่านต่อ

### 3. รันสคริปต์คอมไพล์ (Build)
รันคำสั่งใน PowerShell:
```powershell
# รวม Knowledge และ Data เข้า Apps Script
npm run build

# คอมไพล์หน้าเว็บทั้งหมดลง dist/sites/ และ docs/
npm run build:sites
```

### 4. Deploy Google Apps Script Backend
เมื่อข้อมูลใน Apps Script มีการเปลี่ยนแปลง:
```powershell
npx clasp push
npx clasp deploy -i AKfycbxuj4rSSQDzlcSCVv6QmT_vLcud5P2csRg55FcW4Wa920p4u3KCz-HPtO9gFvVVjwr3 -d "คำอธิบายการอัปเดต"
```

### 5. Git Commit & Push ไปยัง GitHub Pages
```powershell
git add .
git commit -m "feat: อัปเดตข้อมูล..."
git push origin main
```
ระบบ GitHub Actions จะทำการ Build และ Deploy ไปยัง `https://khunpsc.github.io/Rights-Wellfares/` ภายในเวลาประมาณ 1 นาที

---

## เช็กลิสต์การตรวจสอบ (Quality Checklist)
- [ ] หน้าแรก (`home.html`): มีแถบวิ่งข่าวสาร และป๊อปอัปเด้งขึ้นมาถูกต้อง
- [ ] หน้าคู่มือ (`manual.html`): แถบหมวดหมู่ด้านซ้ายแสดงครบถ้วน การ์ดเนื้อหาแสดงป้ายสถานะถูกต้อง
- [ ] ระบบค้นหา: สามารถค้นหาคำสำคัญจากข้อมูลใหม่ได้
- [ ] Deep Linking: ลิงก์ที่ส่งมาจากป๊อปอัปหรือแชทสามารถเปิดและเลื่อนจอมายังหัวข้อใหม่ได้ทันที
