const MODEL = 'claude-opus-5-5';
const MAX_HISTORY_MESSAGES = 20;

const SYSTEM_PROMPT = [
  'คุณคือผู้ช่วยตอบคำถามเรื่องสิทธิและสวัสดิการ ตอบเป็นภาษาไทย สุภาพ กระชับ เข้าใจง่าย',
  'ตอบโดยอิงจากฐานความรู้ด้านล่างเท่านั้น และบอกชื่อหน้าที่ใช้อ้างอิงท้ายคำตอบ',
  'ถ้าฐานความรู้ไม่มีคำตอบ ให้บอกตรง ๆ ว่าไม่มีข้อมูล และแนะนำให้ติดต่อหน่วยงานที่เกี่ยวข้อง อย่าเดา',
  'ถ้าข้อมูลมีวันที่ ให้บอกด้วยว่าเป็นข้อมูล ณ วันใด',
].join('\n');

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ผู้ช่วยสิทธิและสวัสดิการ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    // Required for embedding in Google Sites
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Called from Index.html via google.script.run.
 * @param {{role: 'user'|'assistant', content: string}[]} history
 * @return {string} assistant reply
 */
function chat(history) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ใน Script Properties');

  const messages = history
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: String(m.content) }));
  // History must start with a user turn
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length) throw new Error('ไม่มีคำถาม');

  const body = {
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low' },
    fallbacks: 'default',
    system: [
      { type: 'text', text: SYSTEM_PROMPT },
      // Whole wiki as a cached block: stable prefix, so repeat questions read from cache
      { type: 'text', text: buildKnowledgeText_(), cache_control: { type: 'ephemeral' } },
    ],
    messages: messages,
  };

  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2026-10-21',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });

  const status = res.getResponseCode();
  const data = JSON.parse(res.getContentText());
  if (status !== 200) {
    console.error(status, res.getContentText());
    if (status === 429 || status >= 500) throw new Error('ระบบไม่ว่างชั่วคราว กรุณาลองใหม่อีกครั้ง');
    throw new Error('เกิดข้อผิดพลาด (' + status + ')');
  }
  if (data.stop_reason === 'refusal') {
    return 'ขออภัย ไม่สามารถตอบคำถามนี้ได้';
  }

  return data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

function buildKnowledgeText_() {
  const pages = KNOWLEDGE.map((p) => '<page path="' + p.path + '">\n' + p.text + '\n</page>');
  return '<knowledge_base>\n' + pages.join('\n') + '\n</knowledge_base>';
}

/** Run from the editor to check the API key and model work. */
function testChat() {
  console.log(chat([{ role: 'user', content: 'มีข้อมูลเรื่องอะไรบ้าง' }]));
}
