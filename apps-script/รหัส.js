// ============================================================================
// ส่วนตั้งค่าหลัก (แก้ไข API Key, ชื่อ Model และ System Prompt ได้เองที่นี่)
// ============================================================================
var GEMINI_API_KEY = ''; // ห้ามใส่ key ในโค้ด (ไฟล์นี้อยู่ใน git) — ตั้งใน Script Properties ชื่อ GEMINI_API_KEY

// ระบุชื่อโมเดลที่ต้องการใช้เองได้เลย เช่น:
// 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'
var GEMINI_MODEL = 'gemini-3.5-flash-lite';

// กำหนดคำสั่งควบคุมบทบาท AI (System Prompt) เพิ่มเติมในฝั่ง Server
var CUSTOM_SYSTEM_PROMPT = 'คุณคือ AI ผู้ช่วยตรวจสอบสิทธิค่ารักษาพยาบาลและเบี้ยเลี้ยง-ที่พัก ของ PEA ตอบคำถามอย่างสุภาพ กระชับ ชัดเจน และอ้างอิงเลขข้อระเบียบเสมอ ลงท้ายประโยคด้วยคำว่า"ครับ"เสมอ #กฎ: ห้ามตอบคำถามที่นอกเหนือจากข้อมูลสิทธิค่ารักษาพยาบาลและเบี้ยเลี้ยง-ที่พักที่มีอยู่เด็ดขาด ให้ตอบว่าอยู่นอกขอบเขต' ;

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    
    // ตรวจสอบว่าเป็นการส่ง Feedback หรือไม่
    if (body.action === 'feedback') {
      return handleFeedbackSubmission(body);
    }

    // ==========================================================================
    // ระบบควบคุมความถี่ (Rate Limiting) สำหรับ Gemini API (RPM = 15)
    // ==========================================================================
    var cache = CacheService.getScriptCache();
    var lockKey = 'gemini_rate_limit_lock';
    var lastCallTime = cache.get(lockKey);
    var now = new Date().getTime();
    
    // กำหนดช่วงหน่วงเวลาขั้นต่ำต่อ 1 Request (15 RPM = อย่างน้อย 4,000 มิลลิวินาที หรือ 4 วินาทีต่อ request)
    // หรือถ้ามีผู้ใช้พร้อมกันหลายคน ระบบจะหน่วงคิวอัตโนมัติ
    var minIntervalMs = 4100; 
    
    if (lastCallTime) {
      var elapsed = now - parseInt(lastCallTime, 10);
      if (elapsed < minIntervalMs) {
        var waitTime = minIntervalMs - elapsed;
        Utilities.sleep(waitTime); // หน่วงเวลาเข้าคิวรอรอบ
      }
    }
    // อัปเดตเวลาล่าสุดที่มีการยิง API
    cache.put(lockKey, new Date().getTime().toString(), 60);

    // AI Chat Proxy ปกติ
    var scriptProps = PropertiesService.getScriptProperties();
    var apiKey = scriptProps.getProperty('GEMINI_API_KEY') || GEMINI_API_KEY;
    var userQuestion = body.question || '';
    var history = body.history || [];
    var modelName = scriptProps.getProperty('GEMINI_MODEL') || body.model || GEMINI_MODEL;
    var systemPrompt = CUSTOM_SYSTEM_PROMPT + '\n\n' + (body.systemPrompt || '');

    var contents = [];
    for (var i = 0; i < history.length; i++) {
      contents.push(history[i]);
    }
    contents.push({ role: 'user', parts: [{ text: userQuestion }] });

    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelName.trim()) + ':generateContent?key=' + apiKey;
    var payload = {
      contents: contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.2 }
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    // ยิง API พร้อมระบบ Retry อัตโนมัติกรณีติดข้อจำกัด
    var response = callGeminiWithExponentialBackoff(url, options);
    var result = JSON.parse(response.getContentText());

    if (result.error) {
      // ตรวจสอบกรณีติดโควต้า RPM (Error 429)
      if (result.error.code === 429) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          message: 'มีผู้ใช้งานระบบพร้อมกันจำนวนมาก (เกินโควต้า 15 คำขอต่อนาที) กรุณารอสักครู่แล้วลองส่งคำถามใหม่อีกครั้งครับ'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Gemini API Error: ' + result.error.message
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var answerText = result.candidates && result.candidates[0].content.parts[0].text
      ? result.candidates[0].content.parts[0].text
      : 'ไม่สามารถประมวลผลคำตอบได้ กรุณาลองใหม่อีกครั้ง';

    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      answer: answerText
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ฟังก์ชันยิง API พร้อมระบบพยายามส่งใหม่ (Exponential Backoff) กรณีเซิร์ฟเวอร์หน่วง
function callGeminiWithExponentialBackoff(url, options) {
  var maxRetries = 3;
  var delay = 2000;
  
  for (var i = 0; i < maxRetries; i++) {
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    
    if (code === 200) {
      var json = JSON.parse(response.getContentText());
      if (!json.error || json.error.code !== 429) {
        return response;
      }
    }
    
    // ถ้าติด 429 หรือ 5xx ให้รอเวลาเพิ่มขึ้นแบบทวีคูณแล้วลองใหม่
    Utilities.sleep(delay);
    delay *= 2;
  }
  return UrlFetchApp.fetch(url, options);
}

// ฟังก์ชันบันทึก Feedback ลง Google Sheet
function handleFeedbackSubmission(data) {
  try {
    // ไม่รับ sheetId จาก request: web app เปิดให้ทุกคน ใครก็ส่ง ID ชีตอื่นของเจ้าของมาเขียนได้
    var sheetId = "1dFB_ICZuetflpgsu9SF0u2ciHju7apc5fdvmQK_YgWU";
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheets()[0];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'ประเภทการแจ้ง', 'รายละเอียด', 'ผู้แจ้ง / สังกัด', 'ช่องทางติดต่อ']);
    }

    sheet.appendRow([
      data.timestamp || new Date().toLocaleString('th-TH'),
      data.type || 'อื่นๆ',
      data.detail || '',
      data.sender || 'ไม่ระบุชื่อ',
      data.contact || '-'
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'บันทึกสำเร็จ'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}