# Google Sites Iframe Sandbox & Navigation Reference

เอกสารนี้อธิบายข้อจำกัดของ **Google Sites Embed Sandbox** และวิธีแก้ปัญหาการเชื่อมโยงข้ามหน้า (Cross-Page Navigation) และการดาวน์โหลดไฟล์

---

## 1. ข้อจำกัดของ Google Sites Embed Sandbox

เมื่อเราใช้ฟังก์ชัน **"แทรก -> ฝัง -> ฝังโค้ด (Embed code)"** บน Google Sites ตัวระบบจะครอบโค้ดของเราไว้ใน `<iframe>` ที่มีโดเมนแยกต่างหาก (เช่น `https://[id]-apidata.googleusercontent.com`) โดยมี Attribute sandbox ดังนี้:

```html
<iframe src="https://...googleusercontent.com/..."
        sandbox="allow-scripts allow-popups allow-forms allow-same-origin allow-popups-to-escape-sandbox">
</iframe>
```

### สิทธิ์ที่ขาดหายไป:
* **ไม่อนุญาต `allow-top-navigation`**: ป้องกันไม่ให้โค้ดที่ฝังเข้ามาสั่งเปลี่ยนหน้าต่างหลักของผู้ใช้
* **ไม่อนุญาต `allow-top-navigation-by-user-activation`**

---

## 2. ผลลัพธ์และข้อผิดพลาดที่เกิดขึ้น

หากในโค้ดมีการเรียกคำสั่งใดคำสั่งหนึ่งต่อไปนี้:
* `<a href="https://sites.google.com/..." target="_top">`
* `<a href="https://sites.google.com/..." target="_parent">`
* `window.open(url, '_top')`
* `top.location.href = url`

เบราว์เซอร์จะบล็อกคำสั่งทันที และแสดงข้อผิดพลาดสีแดงใน Console:
```text
Unsafe attempt to initiate navigation for frame with origin 'https://sites.google.com'
from frame with URL 'https://...-apidata.googleusercontent.com/...'.
The frame attempting navigation of the top-level window is sandboxed,
but the flag of 'allow-top-navigation' or 'allow-top-navigation-by-user-activation' is not set.
```
**อาการที่ผู้ใช้เห็น**: คลิกปุ่มหรือการ์ดแล้วนิ่งสนิท ไม่เกิดอะไรขึ้น

---

## 3. วิธีการแก้ปัญหาที่ถูกต้อง (Standard Solution)

### 3.1 ใช้ `target="_blank" rel="noopener"` เท่านั้น
เนื่องจาก Google Sites ให้สิทธิ์ `allow-popups` และ `allow-popups-to-escape-sandbox` ดังนั้นการเปิดแท็บใหม่จะได้รับอนุญาตเสมอ 100%:

```html
<!-- ถูกต้อง: เปิดในแท็บใหม่ได้โดยไม่ถูกบล็อก -->
<a href="https://sites.google.com/view/mysite/manual" target="_blank" rel="noopener">
    เปิดดูคู่มือ
</a>
```

### 3.2 ฟังก์ชัน Navigation ใน JavaScript (`core.js`)
```javascript
function go(pageName, params) {
    const url = pageUrl(pageName);
    if (!url) return;
    
    // บังคับเปิดด้วย _blank เสมอเมื่อทำงานใน Google Sites embed
    window.open(url, '_blank', 'noopener');
}
```

---

## 4. การจัดการลิงก์ดาวน์โหลดเอกสาร (Direct Download)

สำหรับลิงก์ไฟล์ Google Drive หรือ Google Docs ที่ต้องการให้ผู้ใช้กดแล้วดาวน์โหลดลงเครื่องทันที:

### 1) ไฟล์ Google Drive (PDF / รูปภาพ / ZIP)
เปลี่ยน URL จาก `/view` หรือ `/edit` เป็น direct download URL:
* รูปแบบ URL ดูในเบราว์เซอร์: `https://drive.google.com/file/d/<FILE_ID>/view`
* รูปแบบ URL สำหรับดาวน์โหลดทันที: `https://drive.google.com/uc?export=download&id=<FILE_ID>`

### 2) ไฟล์ Google Docs (แปลงเป็น .docx ทันที)
* รูปแบบ URL ดาวน์โหลด Word: `https://docs.google.com/document/d/<DOC_ID>/export?format=docx`

### 3) ตัวอย่าง Tag ที่ถูกต้อง
```html
<a href="https://drive.google.com/uc?export=download&id=1oGxDN54XCipwnIN0VS0SzjRxzNZlB7Az"
   target="_blank"
   rel="noopener"
   class="...">
   <i class="fa-solid fa-cloud-arrow-down mr-1"></i> ดาวน์โหลดไฟล์ PDF ทันที
</a>
```
