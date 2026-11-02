// ============================================================================
// Feedback: บันทึกลง Google Sheet
// ============================================================================
// ไม่รับ sheetId จาก request: web app เปิดให้ทุกคน ใครก็ส่ง ID ชีตอื่นของเจ้าของมาเขียนได้
var FEEDBACK_SHEET_ID = '1dFB_ICZuetflpgsu9SF0u2ciHju7apc5fdvmQK_YgWU';

function handleFeedbackSubmission(data) {
  var detail = cell_(data.detail, 5000);
  if (!detail) return errorOut_('bad_request', 'กรุณาระบุรายละเอียด');

  var sheet = SpreadsheetApp.openById(FEEDBACK_SHEET_ID).getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'ประเภทการแจ้ง', 'รายละเอียด', 'ผู้แจ้ง / สังกัด', 'ช่องทางติดต่อ', 'หน้า']);
  }

  sheet.appendRow([
    // ใช้เวลาฝั่ง server (เวลาจาก client ปลอมได้)
    Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'),
    cell_(data.type, 200) || 'อื่นๆ',
    detail,
    cell_(data.sender, 200) || 'ไม่ระบุชื่อ',
    cell_(data.contact, 200) || '-',
    cell_(data.page, 50) || '-'
  ]);

  return jsonOut_({ ok: true, message: 'บันทึกสำเร็จ' });
}

// ตัดความยาว + กัน formula injection (ค่าที่ขึ้นต้นด้วย = + - @ จะถูกตีความเป็นสูตรใน Sheets)
function cell_(value, maxLen) {
  var s = String(value == null ? '' : value).trim().slice(0, maxLen);
  if (s.length > 1 && /^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
