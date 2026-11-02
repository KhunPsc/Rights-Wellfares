# Caching & CORS Bypass Reference

เอกสารนี้อธิบายเทคนิคการจัดการประสิทธิภาพ (Caching Strategy) และการเลี่ยงปัญหา CORS เมื่อเชื่อมต่อกับ Google Apps Script Web App

---

## 1. การเลี่ยงปัญหา CORS Preflight ใน Google Apps Script

### ปัญหา
Google Apps Script Web App (`/exec`) ทำงานผ่าน Google Redirect Service (`302 Moved Temporarily`) และ **ไม่ตอบรับ HTTP `OPTIONS` method** สำหรับคำขอแบบ CORS Preflight

ถ้า Client ส่งคำขอ POST ด้วย Header:
```javascript
// ห้ามใช้: จะทำให้เบราว์เซอร์ส่ง OPTIONS Preflight และส่งผลให้ Failed to fetch
headers: { 'Content-Type': 'application/json' }
```

### วิธีแก้ที่ถูกต้อง
ส่งด้วย `text/plain;charset=utf-8` ซึ่งจัดอยู่ในหมวดหมู่ Simple Request ของ W3C CORS Spec (เบราว์เซอร์จะไม่ส่งคำขอ Preflight `OPTIONS`):

```javascript
// ฝั่ง Client (core.js)
async function post(body) {
    const res = await fetch(cfg.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
    });
    return await res.json();
}
```

```javascript
// ฝั่ง Server (Router.js ใน Apps Script)
function doPost(e) {
    var raw = (e && e.postData && e.postData.contents) || '{}';
    var body = JSON.parse(raw);
    
    // ดำเนินการต่อตาม action
    if (body.action === 'chat') return handleChat(body);
    if (body.action === 'feedback') return handleFeedback(body);
}
```

---

## 2. รูปแบบแคช Stale-While-Revalidate

ในการทำเว็บแอปที่มีข้อมูลขนาด 100–300 KB การเรียก API ทุกครั้งที่ผู้ใช้เปิดหรือเปลี่ยนหน้า จะทำให้ผู้ใช้รู้สึกว่าเว็บหน่วง (โดยเฉพาะ Apps Script ที่มีเวลา Cold-Start 1.5–3 วินาที)

### หลักการทำงาน
```
 ผู้ใช้เปิดหน้าเว็บ
       │
       ▼
 1. ตรวจสอบ localStorage
       ├── มีข้อมูล ──> นำข้อมูลขึ้นแสดงบนหน้าเว็บทันที (0 ms)
       └── ไม่มี    ──> แสดงกล่อง Loading แล้วดึง ?action=bootstrap
       │
       ▼
 2. เบื้องหลัง (Background Fetch)
       │ ยิงเรียก ?action=version (ขนาดจิ๋ว ~50 bytes)
       ▼
 3. เปรียบเทียบ Version Hash
       ├── เวอร์ชั่นตรงกัน ──> สิ้นสุดกระบวนการ (ใช้แคชเดิมต่อ)
       └── เวอร์ชั่นใหม่กว่า ──> ดึง ?action=bootstrap ใหม่ บันทึกทับ localStorage
                               และอัปเดตหน้าจอให้ทันที
```

### โค้ดตัวอย่างใน `core.js`
```javascript
async function loadData(onData) {
    const cached = storage.get();
    if (cached && cached.data) {
        // เรนเดอร์ทันทีจากแคช
        onData(cached.data, { fromCache: true });
        
        // เช็กเวอร์ชันใหม่เบื้องหลัง
        try {
            const v = await getJson({ action: 'version' });
            if (v.version !== cached.version) {
                const fresh = await fetchBootstrap();
                onData(fresh, { fromCache: false });
            }
        } catch (err) {
            console.warn('[RW] Version check error:', err);
        }
        return cached.data;
    }
    
    // ถ้ายังไม่มีแคช ให้โหลดแบบปกติ
    const fresh = await fetchBootstrap();
    onData(fresh, { fromCache: false });
    return fresh;
}
```

### การคำนวณ Version ใน Apps Script (`build-data.mjs`)
เมื่อรวมไฟล์ `src/data/*.json` เข้าสู่ `apps-script/Data.js` ให้สร้างแฮชสั้น 10 ตัวอักษร เช่น:
```javascript
import { createHash } from 'node:crypto';
const hash = createHash('sha256').update(jsonString).digest('hex').slice(0, 10);
// DATA_VERSION = "8b46998b51"
```
เมื่อข้อมูลมีการเปลี่ยนแปลง แฮชจะเปลี่ยนโดยอัตโนมัติ ทำให้ผู้ใช้ทุกคนได้รับข้อมูลล่าสุดโดยไม่ต้องกดเคลียร์แคชเบราว์เซอร์
