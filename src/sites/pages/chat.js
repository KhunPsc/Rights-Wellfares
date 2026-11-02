// หน้า: ถาม AI ผู้ช่วยตรวจจ่าย กฟภ. & แจ้ง Feedback
let aiChatHistory = [];

function clearAiChat() {
    aiChatHistory = [];
    const box = document.getElementById('aiChatMessages');
    box.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-xl bg-pea-700 text-amber-300 flex items-center justify-center text-sm shrink-0 mt-0.5">
                <i class="fa-solid fa-robot"></i>
            </div>
            <div class="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 text-xs sm:text-sm text-slate-700 shadow-sm max-w-2xl">
                ล้างประวัติการสนทนาแล้วครับ พิมพ์คำถามใหม่เกี่ยวกับระเบียบค่ารักษาพยาบาล หรืออัตราเบี้ยเลี้ยง-ที่พักได้เลยครับ
            </div>
        </div>
    `;
}

function askQuickQuestion(qText) {
    const input = document.getElementById('aiChatInput');
    input.value = qText;
    handleAiChatSubmit(new Event('submit'));
}

function formatAiResponseHtml(text) {
    let safe = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    // Bold **text**
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-pea-900 font-semibold">$1</strong>');
    // Clickable Clause Links e.g., ข้อ 7 or ข้อ 14.1
    safe = safe.replace(/ข้อ\s*(\d{1,2})(?:\.\d+)*/g, (match, numStr) => {
        const n = parseInt(numStr, 10);
        if (n >= 1 && n <= 44) {
            return `<button onclick="RW.openClause(${n})" class="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-100 hover:bg-pea-700 text-pea-800 hover:text-white font-heading font-semibold text-xs transition mx-0.5" title="คลิกเพื่อเปิดดูรายละเอียดข้อ ${n}">${match}</button>`;
        }
        return match;
    });
    return safe.replace(/\n/g, '<br>');
}

async function handleAiChatSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('aiChatInput');
    const sendBtn = document.getElementById('aiChatSendBtn');
    const msgBox = document.getElementById('aiChatMessages');
    const userText = input.value.trim();
    if (!userText) return;

    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    // Render user message bubble
    const userBubble = document.createElement('div');
    userBubble.className = 'flex justify-end';
    userBubble.innerHTML = `
        <div class="max-w-[85%] sm:max-w-xl bg-pea-700 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-xs sm:text-sm shadow-sm leading-relaxed">
            ${userText.replace(/</g, '&lt;')}
        </div>
    `;
    msgBox.appendChild(userBubble);

    // Render loading indicator
    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'flex items-start gap-3';
    loadingBubble.innerHTML = `
        <div class="w-8 h-8 rounded-xl bg-pea-700 text-amber-300 flex items-center justify-center text-sm shrink-0 mt-0.5">
            <i class="fa-solid fa-robot"></i>
        </div>
        <div class="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 text-xs sm:text-sm text-slate-500 shadow-sm flex items-center gap-2.5">
            <i class="fa-solid fa-circle-notch fa-spin text-pea-600"></i>
            <span>กำลังค้นหาคำตอบจากระเบียบ กฟภ. ...</span>
        </div>
    `;
    msgBox.appendChild(loadingBubble);
    msgBox.scrollTop = msgBox.scrollHeight;

    try {
        const res = await RW.post({
            action: 'chat',
            question: userText,
            history: aiChatHistory.slice(-6)
        });

        const answerText = res.answer || 'ไม่ได้รับข้อความตอบกลับจากระบบ';

        aiChatHistory.push({ role: 'user', parts: [{ text: userText }] });
        aiChatHistory.push({ role: 'model', parts: [{ text: answerText }] });

        loadingBubble.innerHTML = `
            <div class="w-8 h-8 rounded-xl bg-pea-700 text-amber-300 flex items-center justify-center text-sm shrink-0 mt-0.5">
                <i class="fa-solid fa-robot"></i>
            </div>
            <div class="max-w-[88%] sm:max-w-2xl bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 text-xs sm:text-sm text-slate-700 shadow-sm leading-relaxed">
                ${formatAiResponseHtml(answerText)}
            </div>
        `;
    } catch (err) {
        loadingBubble.innerHTML = `
            <div class="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center text-sm shrink-0 mt-0.5">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div class="max-w-[88%] sm:max-w-2xl bg-rose-50 border border-rose-200 rounded-2xl rounded-tl-sm p-4 text-xs sm:text-sm text-rose-800 space-y-1.5">
                <div class="font-heading font-bold">ไม่สามารถเชื่อมต่อ AI ได้ในขณะนี้</div>
                <div class="text-xs text-rose-700">${RW.escapeHtml(err.message || 'เกิดข้อผิดพลาดในการติดต่อระบบ')}</div>
                <div class="text-[11px] text-slate-500 pt-1">หากเป็นข้อผิดพลาดชั่วคราว กรุณารอสักครู่แล้วลองใหม่อีกครั้งครับ</div>
            </div>
        `;
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
        msgBox.scrollTop = msgBox.scrollHeight;
    }
}

// ==========================================
// FEEDBACK MODAL LOGIC
// ==========================================
function openFeedbackModal() {
    RW.openFeedback();
}

function closeFeedbackModal() {
    RW.closeFeedback();
}
