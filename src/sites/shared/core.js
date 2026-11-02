// ============================================================================
// core.js — ใช้ร่วมกันทุกหน้า (inline เข้า embed ตอน build)
//   RW.loadData(cb)   ดึงข้อมูลจาก Apps Script + cache ใน localStorage (stale-while-revalidate)
//   RW.post(body)     POST ไป Apps Script (text/plain เพื่อเลี่ยง CORS preflight)
//   RW.go(page)       ไปหน้าอื่นใน Google Sites ตาม config.pages
//   jumpToClause(n)   เปิดข้อคู่มือใน popup (หน้า manual override เป็นเลื่อนไปที่การ์ด)
//   switchMainView(v) = RW.go(v) — เนื้อหาในข้อคู่มือยังเรียกชื่อนี้อยู่
// ============================================================================
const RW = (() => {
    const cfg = window.RW_CONFIG || {};
    const CACHE_KEY = 'rw_bootstrap_v1';
    let data = null;
    let loading = null;

    const storage = {
        get() {
            try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; }
        },
        set(value) {
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch (e) { /* storage ถูกบล็อก — ไม่เป็นไร */ }
        }
    };

    async function getJson(params, retries = 1) {
        const url = cfg.apiUrl + '?' + new URLSearchParams(params).toString();
        try {
            const res = await fetch(url, { method: 'GET', redirect: 'follow' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || json.message || 'ข้อผิดพลาดจากเซิร์ฟเวอร์');
            return json;
        } catch (err) {
            // Apps Script ตื่นช้า (cold start) — ลองใหม่อีกครั้ง
            if (retries > 0) {
                await new Promise(r => setTimeout(r, 1200));
                return getJson(params, retries - 1);
            }
            throw err;
        }
    }

    async function post(body) {
        const res = await fetch(cfg.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body)
        });
        const json = await res.json();
        if (!json.ok && json.status !== 'ok') throw new Error(json.error || json.message || 'ข้อผิดพลาดจากเซิร์ฟเวอร์');
        return json;
    }

    async function fetchBootstrap() {
        const b = await getJson({ action: 'bootstrap' });
        storage.set({ version: b.version, data: b.data });
        data = b.data;
        return data;
    }

    // เรียก onData(data) ทันทีถ้ามี cache แล้วเช็กเวอร์ชันเบื้องหลัง ถ้าใหม่กว่าจะเรียก onData อีกรอบ
    async function loadData(onData) {
        const cached = storage.get();
        if (cached && cached.data) {
            data = cached.data;
            onData(data, { fromCache: true });
            try {
                const v = await getJson({ action: 'version' });
                if (v.version !== cached.version) onData(await fetchBootstrap(), { fromCache: false });
            } catch (err) {
                console.warn('[RW] version check failed', err);
            }
            return data;
        }
        onData(await fetchBootstrap(), { fromCache: false });
        return data;
    }

    // ใช้ข้อมูลแบบไม่ต้อง render ซ้ำ (เช่น popup ข้อคู่มือ)
    function ensureData() {
        if (data) return Promise.resolve(data);
        if (!loading) {
            const cached = storage.get();
            loading = cached && cached.data ? Promise.resolve((data = cached.data)) : fetchBootstrap();
            loading.catch(() => { loading = null; });
        }
        return loading;
    }

    function pageUrl(name) {
        return (cfg.pages && cfg.pages[name]) || '';
    }

    function go(name, params) {
        let url = pageUrl(name);
        if (!url) {
            console.warn('[RW] No URL configured for page:', name);
            alert('ยังไม่ได้ตั้งค่าลิงก์ของหน้านี้ (src/sites/config.json → pages.' + name + ')\nกรุณาใช้เมนูของเว็บไซต์ด้านบน');
            return;
        }

        if (params && params.cat) {
            try { localStorage.setItem('rw_selected_cat', params.cat); } catch (e) {}
            url += (url.includes('?') ? '&' : '?') + 'cat=' + encodeURIComponent(params.cat);
        }
        if (params && params.clause) {
            try { localStorage.setItem('rw_selected_clause', String(params.clause)); } catch (e) {}
            url += (url.includes('?') ? '&' : '?') + 'clause=' + encodeURIComponent(params.clause);
        }

        window.location.href = url;
    }

    function back() {
        if (window.history && window.history.length > 1) {
            window.history.back();
        } else {
            go('home');
        }
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    const fmt = (n) => Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    function errorBox(message, retryFnName) {
        return `
            <div class="bg-white rounded-2xl border border-rose-200 p-8 text-center">
                <i class="fa-solid fa-triangle-exclamation text-3xl text-rose-400 mb-2"></i>
                <h3 class="font-heading font-bold text-slate-700">โหลดข้อมูลจากเซิร์ฟเวอร์ไม่สำเร็จ</h3>
                <p class="text-xs text-slate-500 mt-1">${escapeHtml(message)}</p>
                ${retryFnName ? `<button onclick="${retryFnName}()" class="mt-4 px-4 py-2 rounded-xl bg-pea-700 text-white text-xs font-heading font-semibold"><i class="fa-solid fa-rotate-right mr-1"></i>ลองใหม่</button>` : ''}
            </div>`;
    }

    function loadingBox(text) {
        return `
            <div class="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                <i class="fa-solid fa-circle-notch fa-spin text-pea-600 mr-1.5"></i>${escapeHtml(text || 'กำลังโหลดข้อมูล...')}
            </div>`;
    }

    // ---------- popup แสดงข้อคู่มือ ----------
    function ensureModal() {
        let modal = document.getElementById('rwClauseModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'rwClauseModal';
        modal.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm hidden flex items-start sm:items-center justify-center p-3 sm:p-6';
        modal.innerHTML = `
            <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
                <div class="bg-gradient-to-r from-pea-900 to-pea-700 text-white px-5 py-3.5 flex items-start justify-between gap-3 border-b-2 border-amber-400 shrink-0">
                    <div id="rwClauseModalHead" class="min-w-0"></div>
                    <div class="flex items-center gap-2 shrink-0">
                        <a id="rwClauseModalGoBtn" class="hidden px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-heading font-medium transition flex items-center gap-1.5 no-underline" title="เปิดดูในหน้าคู่มือฉบับเต็ม">
                            <i class="fa-solid fa-up-right-from-square text-[10px]"></i>
                            <span class="hidden sm:inline">เปิดในหน้าคู่มือ</span>
                        </a>
                        <button onclick="RW.closeClause()" class="w-8 h-8 rounded-lg hover:bg-white/15 text-purple-200 hover:text-white flex items-center justify-center shrink-0" title="ปิด">
                            <i class="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                </div>
                <div id="rwClauseModalBody" class="p-5 overflow-y-auto"></div>
            </div>`;
        modal.addEventListener('click', (e) => { if (e.target === modal) closeClause(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeClause(); });
        document.body.appendChild(modal);
        return modal;
    }

    async function openClause(num) {
        const modal = ensureModal();
        const head = document.getElementById('rwClauseModalHead');
        const body = document.getElementById('rwClauseModalBody');
        head.innerHTML = `<div class="font-heading font-bold">ข้อ ${Number(num)}</div>`;
        body.innerHTML = loadingBox();
        modal.classList.remove('hidden');
        try {
            const d = await ensureData();
            const c = d.clauses.find(x => x.num === Number(num));
            if (!c) {
                body.innerHTML = `<p class="text-sm text-slate-600">ไม่พบข้อ ${Number(num)}</p>`;
                return;
            }
            head.innerHTML = `
                <div class="text-[11px] text-amber-200 font-heading">ข้อ ${c.num} · ${escapeHtml(c.page)}</div>
                <div class="font-heading font-bold text-sm sm:text-base">${escapeHtml(c.title)}</div>`;
            body.innerHTML = c.content;

            const goBtn = document.getElementById('rwClauseModalGoBtn');
            if (goBtn) {
                if (cfg.page === 'manual') {
                    goBtn.classList.add('hidden');
                } else {
                    goBtn.classList.remove('hidden');
                    const manualUrl = pageUrl('manual') || 'manual.html';
                    goBtn.href = manualUrl + '?clause=' + encodeURIComponent(c.num);
                    goBtn.onclick = () => {
                        try { localStorage.setItem('rw_selected_clause', String(c.num)); } catch (e) {}
                    };
                }
            }
        } catch (err) {
            body.innerHTML = errorBox(err.message);
        }
    }

    function closeClause() {
        const modal = document.getElementById('rwClauseModal');
        if (modal) modal.classList.add('hidden');
    }

    // ---------- Floating AI Chatbot Widget Logic ----------
    let floatingChatHistory = [];

    function toggleChat(forceOpen) {
        const panel = document.getElementById('rwChatPanel');
        const fab = document.getElementById('rwChatFab');
        if (!panel || !fab) return;
        const isHidden = panel.classList.contains('hidden');
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isHidden;
        if (shouldOpen) {
            panel.classList.remove('hidden');
            fab.classList.add('hidden');
            setTimeout(() => document.getElementById('rwFloatingChatInput')?.focus(), 100);
        } else {
            panel.classList.add('hidden');
            fab.classList.remove('hidden');
        }
    }

    function clearChat() {
        floatingChatHistory = [];
        const box = document.getElementById('rwFloatingChatMessages');
        if (box) {
            box.innerHTML = `
                <div class="flex items-start gap-2.5">
                    <div class="w-7 h-7 rounded-lg bg-pea-700 text-amber-300 flex items-center justify-center text-xs shrink-0 mt-0.5">
                        <i class="fa-solid fa-robot"></i>
                    </div>
                    <div class="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-3 text-slate-700 shadow-sm text-xs">
                        ล้างประวัติการสนทนาแล้วครับ พิมพ์คำถามใหม่เกี่ยวกับระเบียบค่ารักษาพยาบาล หรืออัตราเบี้ยเลี้ยง-ที่พักได้เลยครับ
                    </div>
                </div>`;
        }
    }

    function askQuestion(qText) {
        toggleChat(true);
        const input = document.getElementById('rwFloatingChatInput');
        if (input) {
            input.value = qText;
            handleChatSubmit(new Event('submit'));
        }
    }

    function formatChatText(text) {
        let safe = escapeHtml(text);
        safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-pea-900 font-semibold">$1</strong>');
        safe = safe.replace(/ข้อ\s*(\d{1,2})(?:\.\d+)*/g, (match, numStr) => {
            const n = parseInt(numStr, 10);
            if (n >= 1 && n <= 44) {
                return `<button type="button" onclick="RW.openClause(${n})" class="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-100 hover:bg-pea-700 text-pea-800 hover:text-white font-heading font-semibold text-[11px] transition mx-0.5" title="คลิกเปิดดูข้อ ${n}">${match}</button>`;
            }
            return match;
        });
        return safe.replace(/\n/g, '<br>');
    }

    async function handleChatSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();
        const input = document.getElementById('rwFloatingChatInput');
        const sendBtn = document.getElementById('rwFloatingChatSendBtn');
        const msgBox = document.getElementById('rwFloatingChatMessages');
        if (!input || !sendBtn || !msgBox) return;

        const userText = input.value.trim();
        if (!userText) return;

        input.value = '';
        input.disabled = true;
        sendBtn.disabled = true;

        const userBubble = document.createElement('div');
        userBubble.className = 'flex justify-end';
        userBubble.innerHTML = `
            <div class="max-w-[85%] bg-pea-700 text-white rounded-2xl rounded-tr-sm px-3.5 py-2 text-xs shadow-sm leading-relaxed">
                ${escapeHtml(userText)}
            </div>`;
        msgBox.appendChild(userBubble);

        const loadingBubble = document.createElement('div');
        loadingBubble.className = 'flex items-start gap-2.5';
        loadingBubble.innerHTML = `
            <div class="w-7 h-7 rounded-lg bg-pea-700 text-amber-300 flex items-center justify-center text-xs shrink-0 mt-0.5">
                <i class="fa-solid fa-robot"></i>
            </div>
            <div class="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs text-slate-500 shadow-sm flex items-center gap-2">
                <i class="fa-solid fa-circle-notch fa-spin text-pea-600"></i>
                <span>กำลังค้นหาคำตอบ...</span>
            </div>`;
        msgBox.appendChild(loadingBubble);
        msgBox.scrollTop = msgBox.scrollHeight;

        try {
            const res = await post({
                action: 'chat',
                question: userText,
                history: floatingChatHistory.slice(-6)
            });

            const answerText = res.answer || 'ไม่ได้รับข้อความตอบกลับ';
            floatingChatHistory.push({ role: 'user', parts: [{ text: userText }] });
            floatingChatHistory.push({ role: 'model', parts: [{ text: answerText }] });

            loadingBubble.innerHTML = `
                <div class="w-7 h-7 rounded-lg bg-pea-700 text-amber-300 flex items-center justify-center text-xs shrink-0 mt-0.5">
                    <i class="fa-solid fa-robot"></i>
                </div>
                <div class="max-w-[88%] bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-3 text-xs text-slate-700 shadow-sm leading-relaxed">
                    ${formatChatText(answerText)}
                </div>`;
        } catch (err) {
            loadingBubble.innerHTML = `
                <div class="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center text-xs shrink-0 mt-0.5">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div class="max-w-[88%] bg-rose-50 border border-rose-200 rounded-2xl rounded-tl-sm p-2.5 text-xs text-rose-800">
                    ${escapeHtml(err.message || 'ไม่สามารถเชื่อมต่อได้ในขณะนี้')}
                </div>`;
        } finally {
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
            msgBox.scrollTop = msgBox.scrollHeight;
        }
    }

    // ---------- Feedback Modal Logic ----------
    function openFeedback() {
        const modal = document.getElementById('rwFeedbackModal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeFeedback() {
        const modal = document.getElementById('rwFeedbackModal');
        if (modal) {
            modal.classList.add('hidden');
            const form = document.getElementById('rwFeedbackForm');
            if (form) form.reset();
            const alertBox = document.getElementById('rwFbAlertBox');
            if (alertBox) alertBox.classList.add('hidden');
        }
    }

    async function submitFeedback(e) {
        if (e && e.preventDefault) e.preventDefault();
        const btn = document.getElementById('rwFbSubmitBtn');
        const alertBox = document.getElementById('rwFbAlertBox');
        const detailInput = document.getElementById('rwFbDetail');
        if (!detailInput || !btn || !alertBox) return;

        const payload = {
            action: 'feedback',
            type: document.getElementById('rwFbType')?.value || 'อื่นๆ',
            detail: detailInput.value.trim(),
            sender: document.getElementById('rwFbSender')?.value.trim() || 'ไม่ระบุชื่อ',
            contact: document.getElementById('rwFbContact')?.value.trim() || '-',
            page: cfg.page || 'home'
        };

        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i> กำลังส่งข้อมูล...`;
        alertBox.classList.add('hidden');

        try {
            const res = await post(payload);
            alertBox.className = "p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs";
            alertBox.innerHTML = `<i class="fa-solid fa-circle-check mr-1 text-emerald-600"></i> แจ้งข้อเสนอแนะสำเร็จเรียบร้อยแล้ว ขอบคุณครับ!`;
            alertBox.classList.remove('hidden');

            setTimeout(() => {
                closeFeedback();
            }, 1800);
        } catch (err) {
            alertBox.className = "p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs";
            alertBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1 text-rose-600"></i> ไม่สามารถบันทึกได้: ${escapeHtml(err.message || 'กรุณาลองใหม่อีกครั้ง')}`;
            alertBox.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-paper-plane mr-1"></i> ยืนยัน ส่งข้อมูล`;
        }
    }

    return {
        config: cfg,
        get data() { return data; },
        loadData, ensureData, post, go, back, pageUrl,
        escapeHtml, fmt, errorBox, loadingBox,
        openClause, closeClause,
        toggleChat, clearChat, askQuestion, handleChatSubmit,
        openFeedback, closeFeedback, submitFeedback
    };
})();

// ชื่อเดิมที่ยังถูกเรียกจาก onclick ในเนื้อหาข้อคู่มือ / การ์ดสรุป
function switchMainView(view) { RW.go(view); }
function jumpToClause(num) { RW.openClause(num); }
function openFeedbackModal() { RW.openFeedback(); }
function closeFeedbackModal() { RW.closeFeedback(); }
