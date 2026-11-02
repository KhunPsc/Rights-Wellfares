// ============================================================================
// Chat: proxy ไป Gemini — system prompt สร้างฝั่ง server จาก Data.js เท่านั้น
// (ไม่รับ systemPrompt / model จาก client เพื่อไม่ให้ใครเอา proxy ไปใช้ Gemini ฟรี)
// ============================================================================
var GEMINI_API_KEY = ''; // ห้ามใส่ key ในโค้ด (ไฟล์นี้อยู่ใน git) — ตั้งใน Script Properties ชื่อ GEMINI_API_KEY

// ระบุชื่อโมเดลที่ต้องการใช้เองได้เลย เช่น:
// 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'
// (override ได้ด้วย Script Properties ชื่อ GEMINI_MODEL)
var GEMINI_MODEL = 'gemini-3.5-flash-lite';

// กำหนดคำสั่งควบคุมบทบาท AI (System Prompt) เพิ่มเติมในฝั่ง Server
var CUSTOM_SYSTEM_PROMPT = 'คุณคือ AI ผู้ช่วยตรวจสอบสิทธิค่ารักษาพยาบาลและเบี้ยเลี้ยง-ที่พัก ของ PEA ตอบคำถามอย่างสุภาพ กระชับ ชัดเจน และอ้างอิงเลขข้อระเบียบเสมอ ลงท้ายประโยคด้วยคำว่า"ครับ"เสมอ #กฎ: ห้ามตอบคำถามที่นอกเหนือจากข้อมูลสิทธิค่ารักษาพยาบาลและเบี้ยเลี้ยง-ที่พักที่มีอยู่เด็ดขาด ให้ตอบว่าอยู่นอกขอบเขต' ;

var CHAT_MAX_QUESTION_CHARS = 1000;
var CHAT_MAX_HISTORY = 10; // จำนวนข้อความย้อนหลัง (user+model) ที่ส่งต่อให้ Gemini

function handleChat(body) {
  var question = String(body.question || '').trim();
  if (!question) return errorOut_('bad_request', 'กรุณาพิมพ์คำถาม');
  if (question.length > CHAT_MAX_QUESTION_CHARS) {
    return errorOut_('bad_request', 'คำถามยาวเกินไป (ไม่เกิน ' + CHAT_MAX_QUESTION_CHARS + ' ตัวอักษร)');
  }

  throttleGemini_();

  var scriptProps = PropertiesService.getScriptProperties();
  var apiKey = scriptProps.getProperty('GEMINI_API_KEY') || GEMINI_API_KEY;
  var modelName = scriptProps.getProperty('GEMINI_MODEL') || GEMINI_MODEL;
  var includeWiki = scriptProps.getProperty('CHAT_INCLUDE_WIKI') === 'true';

  var contents = sanitizeHistory_(body.history);
  contents.push({ role: 'user', parts: [{ text: question }] });

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelName.trim()) + ':generateContent?key=' + apiKey;
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      contents: contents,
      systemInstruction: { parts: [{ text: buildSystemPrompt_(includeWiki) }] },
      generationConfig: { temperature: 0.2 }
    }),
    muteHttpExceptions: true
  };

  // ยิง API พร้อมระบบ Retry อัตโนมัติกรณีติดข้อจำกัด
  var response = callGeminiWithExponentialBackoff(url, options);
  var result = JSON.parse(response.getContentText());

  if (result.error) {
    // ตรวจสอบกรณีติดโควต้า RPM (Error 429)
    if (result.error.code === 429) {
      return errorOut_('rate_limited', 'มีผู้ใช้งานระบบพร้อมกันจำนวนมาก (เกินโควต้า 15 คำขอต่อนาที) กรุณารอสักครู่แล้วลองส่งคำถามใหม่อีกครั้งครับ');
    }
    return errorOut_('gemini_error', 'Gemini API Error: ' + result.error.message);
  }

  var parts = result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts;
  var answerText = parts && parts[0] && parts[0].text
    ? parts[0].text
    : 'ไม่สามารถประมวลผลคำตอบได้ กรุณาลองใหม่อีกครั้ง';

  return jsonOut_({ ok: true, answer: answerText });
}

// ==========================================================================
// ระบบควบคุมความถี่ (Rate Limiting) สำหรับ Gemini API (RPM = 15)
// กำหนดช่วงหน่วงเวลาขั้นต่ำต่อ 1 Request (15 RPM = อย่างน้อย 4 วินาทีต่อ request)
// หรือถ้ามีผู้ใช้พร้อมกันหลายคน ระบบจะหน่วงคิวอัตโนมัติ
// ==========================================================================
function throttleGemini_() {
  var cache = CacheService.getScriptCache();
  var lockKey = 'gemini_rate_limit_lock';
  var minIntervalMs = 4100;
  var lastCallTime = cache.get(lockKey);
  if (lastCallTime) {
    var elapsed = new Date().getTime() - parseInt(lastCallTime, 10);
    if (elapsed < minIntervalMs) {
      Utilities.sleep(minIntervalMs - elapsed); // หน่วงเวลาเข้าคิวรอรอบ
    }
  }
  // อัปเดตเวลาล่าสุดที่มีการยิง API
  cache.put(lockKey, String(new Date().getTime()), 60);
}

// รับเฉพาะ { role: 'user'|'model', parts: [{ text }] } และตัดให้เหลือ CHAT_MAX_HISTORY ข้อความล่าสุด
function sanitizeHistory_(history) {
  if (!Array.isArray(history)) return [];
  var clean = [];
  for (var i = 0; i < history.length; i++) {
    var h = history[i];
    if (!h || (h.role !== 'user' && h.role !== 'model') || !Array.isArray(h.parts) || !h.parts[0]) continue;
    var text = String(h.parts[0].text || '').slice(0, 4000);
    if (text) clean.push({ role: h.role, parts: [{ text: text }] });
  }
  return clean.slice(-CHAT_MAX_HISTORY);
}

function buildSystemPrompt_(includeWiki) {
  var clauses = SITE_DATA.clauses.map(function (c) {
    var plain = String(c.content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return '[ข้อ ' + c.num + ' (' + c.page + ') ' + c.title + ']: ' + plain;
  }).join('\n');

  var prompt = CUSTOM_SYSTEM_PROMPT + '\n\n' + CHAT_PROMPT_HEADER + '\n\nรายละเอียดคู่มือครบทั้ง ' + SITE_DATA.clauses.length + ' ข้อ:\n' + clauses;

  // wiki (Knowledge.js) ใหญ่มาก — เปิดใช้ด้วย Script Properties CHAT_INCLUDE_WIKI = true เมื่อโควต้า token พอ
  if (includeWiki && typeof KNOWLEDGE !== 'undefined') {
    prompt += '\n\nฐานความรู้เพิ่มเติม (wiki):\n' + KNOWLEDGE.map(function (p) {
      return '### ' + p.path + '\n' + p.text;
    }).join('\n\n');
  }
  return prompt;
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
