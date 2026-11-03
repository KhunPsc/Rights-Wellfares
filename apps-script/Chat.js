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
var CUSTOM_SYSTEM_PROMPT = 'คุณคือ AI ผู้ช่วยตอบคำถามเรื่องสิทธิและสวัสดิการของพนักงานและลูกจ้าง PEA ตอบคำถามอย่างสุภาพ กระชับ ชัดเจน ลงท้ายประโยคด้วยคำว่า"ครับ"เสมอ ' +
  'อ้างอิงเลขข้อเมื่อตอบจากคู่มือ (เช่น ข้อ 7) และอ้างชื่อหัวข้อเมื่อตอบจากฐานความรู้ (wiki) ' +
  '#กฎ: ตอบจากคู่มือและฐานความรู้ที่ให้ไว้เท่านั้น ห้ามเดา ถ้าไม่มีข้อมูลให้บอกตรง ๆ ว่าไม่มีข้อมูลในระบบ และแนะนำให้สอบถามแผนกสวัสดิการ ' +
  'คำถามที่ไม่เกี่ยวกับสิทธิ สวัสดิการ หรือการเบิกจ่ายของ PEA ให้ตอบว่าอยู่นอกขอบเขต';

var CHAT_MAX_QUESTION_CHARS = 1000;
var CHAT_MAX_HISTORY = 10; // จำนวนข้อความย้อนหลัง (user+model) ที่ส่งต่อให้ Gemini
var CHAT_WIKI_MAX_CHARS = 20000; // งบตัวอักษรของหน้า wiki ที่แนบต่อคำถาม (ทั้ง wiki ~130K ตัวอักษร ใหญ่เกินโควต้า)
var CHAT_WIKI_MAX_PAGES = 5;

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

  var contents = sanitizeHistory_(body.history);
  // คำถามต่อเนื่อง ("แล้วลูกจ้างล่ะ") สั้นเกินจะหาหน้าเจอ — รวมคำถามก่อนหน้าด้วย
  var lastUser = contents.filter(function (m) { return m.role === 'user'; }).pop();
  var wikiPages = selectWikiPages_(question + ' ' + (lastUser ? lastUser.parts[0].text : ''));
  contents.push({ role: 'user', parts: [{ text: question }] });

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelName.trim()) + ':generateContent?key=' + apiKey;
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      contents: contents,
      systemInstruction: { parts: [{ text: buildSystemPrompt_(wikiPages) }] },
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

function buildSystemPrompt_(wikiPages) {
  var clauses = SITE_DATA.clauses.map(function (c) {
    var plain = String(c.content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return '[ข้อ ' + c.num + ' (' + c.page + ') ' + c.title + ']: ' + plain;
  }).join('\n');

  var prompt = CUSTOM_SYSTEM_PROMPT + '\n\n' + CHAT_PROMPT_HEADER + '\n\nรายละเอียดคู่มือครบทั้ง ' + SITE_DATA.clauses.length + ' ข้อ:\n' + clauses;

  if (wikiPages && wikiPages.length) {
    prompt += '\n\nฐานความรู้เพิ่มเติม (wiki) — เฉพาะหัวข้อที่เกี่ยวกับคำถาม:\n' + wikiPages.map(function (p) {
      return '### ' + p.title + '\n' + p.body;
    }).join('\n\n');
  }
  return prompt;
}

// เลือกหน้า wiki ที่เกี่ยวกับคำถาม: ให้คะแนนจาก "ตัวอักษรคู่ติดกัน" (bigram) ที่ตรงกัน
// เพราะภาษาไทยไม่เว้นวรรคระหว่างคำ ตัดคำไม่ได้ · bigram ที่พบทุกหน้า (เช่น "ค่า") ได้น้ำหนักน้อย (IDF)
// shortcut: จับคู่ตัวอักษร ไม่เข้าใจความหมาย — ถ้าตอบผิดหน้าบ่อย ค่อยเปลี่ยนเป็น embedding search
function selectWikiPages_(text) {
  if (typeof KNOWLEDGE === 'undefined') return [];
  var pages = getWikiIndex_();
  var q = bigrams_(text);
  if (!q.length) return [];

  var df = {};
  q.forEach(function (g) {
    df[g] = pages.filter(function (p) { return p.grams[g]; }).length;
  });

  var avgLen = pages.reduce(function (n, p) { return n + p.body.length; }, 0) / pages.length;
  var scored = pages.map(function (p) {
    var lengthNorm = 2 * avgLen / (avgLen + p.body.length); // หน้ายาวมี bigram ครบโดยบังเอิญ — ลดน้ำหนัก
    var score = 0;
    q.forEach(function (g) {
      if (!df[g]) return;
      var idf = Math.log(pages.length / df[g]);
      if (p.titleGrams[g]) score += 3 * idf; // ชื่อหน้าตรง สำคัญกว่าเนื้อหา
      else if (p.grams[g]) score += idf * lengthNorm;
    });
    return { page: p, score: score };
  }).filter(function (s) { return s.score > 0; })
    .sort(function (a, b) { return b.score - a.score; });

  var picked = [];
  var used = 0;
  for (var i = 0; i < scored.length && picked.length < CHAT_WIKI_MAX_PAGES; i++) {
    var p = scored[i].page;
    if (used + p.body.length > CHAT_WIKI_MAX_CHARS) continue;
    picked.push(p);
    used += p.body.length;
  }
  return picked;
}

var wikiIndex_ = null;
function getWikiIndex_() {
  if (wikiIndex_) return wikiIndex_;
  wikiIndex_ = KNOWLEDGE.filter(function (p) {
    // หน้าสรุปแหล่งข้อมูลและสารบัญซ้ำกับหน้าหัวข้อ — ไม่ต้องแนบ
    return p.path.indexOf('sources/') !== 0 && p.path !== 'index.md';
  }).map(function (p) {
    var body = p.text.replace(/^---[\s\S]*?\n---\n/, '').trim(); // ตัด frontmatter
    var titleMatch = p.text.match(/^title:\s*"?(.+?)"?\s*$/m);
    var tagsMatch = p.text.match(/^tags:\s*\[(.*)\]\s*$/m);
    var title = titleMatch ? titleMatch[1] : p.path;
    return {
      title: title,
      body: body,
      titleGrams: toSet_(bigrams_(title + ' ' + (tagsMatch ? tagsMatch[1] : ''))),
      grams: toSet_(bigrams_(body))
    };
  });
  return wikiIndex_;
}

// คำถามทั่วไปที่ไม่บอกหัวข้อ — ตัดทิ้งก่อนจับคู่
var CHAT_STOP_PHRASES = ['เท่าไหร่', 'เท่าไร', 'ได้ไหม', 'ได้มั้ย', 'หรือไม่', 'อย่างไร', 'ยังไง', 'บ้าง', 'กี่บาท', 'กี่เท่า', 'กี่วัน', 'ครับ', 'ค่ะ', 'คะ'];
// คำพูดทั่วไป → คำที่เอกสารใช้
// (คำยาวต้องมาก่อนคำสั้นที่เป็นส่วนหนึ่งของมัน เช่น "นอนโรงพยาบาล" ก่อน "โรงพยาบาล")
var CHAT_SYNONYMS = { 'นอนโรงพยาบาล': 'ผู้ป่วยใน', 'โรงพยาบาล': 'รพ', 'ลูก': 'บุตร', 'หมอ': 'แพทย์', 'ทำโอที': 'ค่าล่วงเวลา', 'แฟน': 'คู่สมรส', 'เมีย': 'คู่สมรส', 'ผัว': 'คู่สมรส' };

// ภาษาไทย → bigram (ตัดคำไม่ได้) · อังกฤษ/ตัวเลข → ทั้งคำ (เช่น OT, UCEP)
function bigrams_(text) {
  var s = String(text).toLowerCase();
  CHAT_STOP_PHRASES.forEach(function (w) { s = s.split(w).join(' '); });
  Object.keys(CHAT_SYNONYMS).forEach(function (w) { s = s.split(w).join(' ' + CHAT_SYNONYMS[w] + ' '); });
  var out = [];
  (s.match(/[฀-๿]+|[a-z0-9]+/g) || []).forEach(function (w) {
    if (!/[฀-๿]/.test(w)) { if (w.length > 1) out.push(w); return; }
    for (var i = 0; i + 1 < w.length; i++) out.push(w.substr(i, 2));
  });
  return Object.keys(toSet_(out));
}

function toSet_(arr) {
  var set = {};
  for (var i = 0; i < arr.length; i++) set[arr[i]] = true;
  return set;
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
