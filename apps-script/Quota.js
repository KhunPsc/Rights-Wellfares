// ============================================================================
// Quota: จำกัดจำนวนคำขอรวมทุกผู้ใช้ (Apps Script ไม่รู้ IP ของผู้เรียก จึงจำกัดรายคนไม่ได้)
//   นาที → CacheService (หมดอายุเอง) · วัน → Script Properties (เก็บค่าเดียวต่อชื่อ "วันที่|จำนวน")
//   ScriptLock กันคำขอพร้อมกันอ่าน-เขียนตัวนับทับกัน
// ============================================================================
var QUOTA = {
  // Gemini free tier: 15 RPM / 250 RPD (รีเซ็ตเที่ยงคืนเวลาแปซิฟิก ≈ 14:00–15:00 น. ไทย) — เผื่อไว้สำหรับ retry
  chat: { perMinute: 14, perDay: 240, tz: 'America/Los_Angeles' },
  feedback: { perMinute: 10, perDay: 100, tz: 'Asia/Bangkok' }
};

// คืน { ok: true } หรือ { ok: false, reason: 'minute'|'day'|'busy', retryAfter }
function takeQuota_(name) {
  var q = QUOTA[name];
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, reason: 'busy' };
  try {
    var now = new Date();
    var cache = CacheService.getScriptCache();
    var props = PropertiesService.getScriptProperties();
    var minuteKey = 'quota_' + name + '_m' + Math.floor(now.getTime() / 60000);
    var dayKey = 'quota_' + name + '_day';
    var day = Utilities.formatDate(now, q.tz, 'yyyy-MM-dd');
    var saved = String(props.getProperty(dayKey) || '').split('|');
    var dayCount = saved[0] === day ? Number(saved[1]) || 0 : 0;
    var minuteCount = Number(cache.get(minuteKey)) || 0;

    if (dayCount >= q.perDay) return { ok: false, reason: 'day' };
    if (minuteCount >= q.perMinute) return { ok: false, reason: 'minute', retryAfter: 60 - now.getSeconds() };

    cache.put(minuteKey, String(minuteCount + 1), 120);
    props.setProperty(dayKey, day + '|' + (dayCount + 1));
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// ดูยอดใช้วันนี้ใน editor: เลือกฟังก์ชันนี้แล้วกด Run
function showQuotaUsage() {
  var props = PropertiesService.getScriptProperties();
  Object.keys(QUOTA).forEach(function (name) {
    console.log(name + ': ' + (props.getProperty('quota_' + name + '_day') || '-') + ' / ' + QUOTA[name].perDay + ' ต่อวัน');
  });
}
