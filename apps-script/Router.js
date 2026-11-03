// ============================================================================
// Router: จุดเข้าของ Web App (/exec)
//   GET  ?action=bootstrap  → ข้อมูลทั้งหมดที่หน้าเว็บใช้ (หมวด, ข้อคู่มือ, อัตรา, wizard, ฟอร์ม)
//   GET  ?action=version    → เวอร์ชันข้อมูล (ให้ client เช็ก cache)
//   POST { action: 'chat', question, history }
//   POST { action: 'feedback', type, detail, sender, contact, page }
//   POST แบบเดิม (ไม่มี action) = chat — เพื่อให้ index.html ตัวเก่ายังใช้ได้ระหว่างย้ายระบบ
// ทุก response มีทั้ง ok (ใหม่) และ status (เดิม)
// ============================================================================

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'version';
  try {
    if (action === 'bootstrap') {
      return jsonOut_({ ok: true, version: DATA_VERSION, data: SITE_DATA });
    }
    if (action === 'version') {
      return jsonOut_({ ok: true, version: DATA_VERSION });
    }
    return errorOut_('unknown_action', 'ไม่รู้จัก action: ' + action);
  } catch (err) {
    console.error(err);
    return errorOut_('server_error', 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง');
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'feedback') {
      return handleFeedbackSubmission(body);
    }
    if (!body.action || body.action === 'chat') {
      return handleChat(body);
    }
    return errorOut_('unknown_action', 'ไม่รู้จัก action: ' + body.action);
  } catch (err) {
    console.error(err);
    return errorOut_('server_error', 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง');
  }
}

function jsonOut_(obj) {
  if (obj.ok && !obj.status) obj.status = 'ok';
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function errorOut_(code, message) {
  return jsonOut_({ ok: false, status: 'error', code: code, error: message, message: message });
}
