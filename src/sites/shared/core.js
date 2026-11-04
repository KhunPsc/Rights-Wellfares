// ============================================================================
// core.js — ใช้ร่วมกันทุกหน้า (inline เข้า embed ตอน build)
//   RW.loadData(cb)   ดึงข้อมูลจาก Apps Script + cache ใน localStorage (stale-while-revalidate)
//   RW.post(body)     POST ไป Apps Script (text/plain เพื่อเลี่ยง CORS preflight)
//   RW.go(page)       ไปหน้าอื่นใน Google Sites ตาม config.pages
//   jumpToClause(n)   เปิดข้อคู่มือใน popup (ปุ่มในป๊อปอัปพาไปบทที่มีข้อนั้นในหน้า book)
//   switchMainView(v) = RW.go(v) — เนื้อหาในข้อคู่มือยังเรียกชื่อนี้อยู่
// ============================================================================
const RW = (() => {
    const cfg = window.RW_CONFIG || {};
    const CACHE_KEY = 'rw_bootstrap_v2';
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

    // แถบ skeleton กะพริบ (motion-safe: ไม่กะพริบถ้าผู้ใช้ตั้งลดภาพเคลื่อนไหว)
    function skeleton(lines = 4) {
        const widths = ['w-3/4', 'w-full', 'w-5/6', 'w-2/3', 'w-11/12', 'w-1/2'];
        return `<div class="space-y-2.5 motion-safe:animate-pulse" aria-hidden="true">
            <div class="h-5 w-2/5 rounded-lg bg-slate-200"></div>
            ${Array.from({ length: lines }, (_, i) => `<div class="h-3.5 ${widths[i % widths.length]} rounded bg-slate-200/80"></div>`).join('')}
        </div>`;
    }

    function loadingBox(text) {
        return `
            <div class="bg-white rounded-2xl border border-slate-200 p-6" role="status">
                ${skeleton(4)}
                <p class="mt-4 text-xs text-slate-400"><i class="fa-solid fa-circle-notch fa-spin text-pea-600 mr-1.5"></i>${escapeHtml(text || 'กำลังโหลดข้อมูล...')}</p>
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
                        <a id="rwClauseModalGoBtn" class="hidden px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-heading font-medium transition flex items-center gap-1.5 no-underline" title="เปิดอ่านในหนังสือ">
                            <i class="fa-solid fa-up-right-from-square text-[10px]"></i>
                            <span class="hidden sm:inline">เปิดในหนังสือ</span>
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
            const c = d.clauses.find(x => String(x.num) === String(num));
            if (!c) {
                body.innerHTML = `<p class="text-sm text-slate-600">ไม่พบข้อมูลระเบียบที่ระบุ</p>`;
                return;
            }
            const numLabel = typeof c.num === 'number' ? `ข้อ ${c.num}` : 'หลักเกณฑ์และแนวทางปฏิบัติ';
            head.innerHTML = `
                <div class="text-[11px] text-amber-200 font-heading">${numLabel} · ${escapeHtml(c.page)}</div>
                <div class="font-heading font-bold text-sm sm:text-base">${escapeHtml(c.title)}</div>`;
            body.innerHTML = c.content;

            const goBtn = document.getElementById('rwClauseModalGoBtn');
            if (goBtn) {
                // ไปที่ข้อนี้ในเล่มคู่มือ 44 ข้อ (บท = หมวดที่มีข้อนี้)
                const book = (d.books || []).find(b => b.chapters.some(ch => ch.clauses));
                const ch = book && book.chapters.find(x => (x.clauses || []).map(String).includes(String(c.num)));
                goBtn.classList.toggle('hidden', !ch);
                if (ch) {
                    const key = `${book.id}|${ch.num}|${c.num}`;
                    goBtn.href = `${pageUrl('book') || 'book.html'}?book=${encodeURIComponent(book.id)}&ch=${ch.num}&clause=${encodeURIComponent(c.num)}`;
                    goBtn.onclick = () => {
                        try { localStorage.setItem('rw_book', key); } catch (e) {}
                        if (cfg.page === 'book' && window.bookGo) { closeClause(); return window.bookGo(book.id, ch.num, String(c.num)); }
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

    // ---------- popup แสดงข่าวสาร / ประกาศระเบียบ ----------
    function ensureNewsModal() {
        let modal = document.getElementById('rwNewsModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'rwNewsModal';
        modal.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm hidden flex items-start sm:items-center justify-center p-3 sm:p-6';
        modal.innerHTML = `
            <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div class="bg-gradient-to-r from-pea-900 via-pea-800 to-purple-800 text-white px-5 py-4 flex items-start justify-between gap-3 border-b-2 border-amber-400 shrink-0">
                    <div id="rwNewsModalHead" class="min-w-0 space-y-1"></div>
                    <button onclick="RW.closeNewsModal()" class="w-8 h-8 rounded-lg hover:bg-white/15 text-purple-200 hover:text-white flex items-center justify-center shrink-0 cursor-pointer" title="ปิด">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>
                <div id="rwNewsModalBody" class="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm"></div>
                <div class="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <button
                        type="button"
                        onclick="RW.closeNewsModal(); RW.askQuestion('แนวทางการเบิกจ่ายค่ารักษาด้วยวิธีปักปากกาควบคุมน้ำหนัก (Weight Loss Injection Pen) ตามหนังสือ กสก.(สก)1375/2569 มีเงื่อนไขอย่างไร?');"
                        class="px-3.5 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-pea-800 font-heading font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                        <i class="fa-solid fa-robot text-amber-600"></i>
                        <span>ถาม AI ผู้ช่วยเกี่ยวกับเรื่องนี้</span>
                    </button>
                    <button
                        type="button"
                        onclick="RW.closeNewsModal()"
                        class="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-heading font-semibold text-xs transition cursor-pointer"
                    >
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>`;
        modal.addEventListener('click', (e) => { if (e.target === modal) closeNewsModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNewsModal(); });
        document.body.appendChild(modal);
        return modal;
    }

    async function openNewsModal(newsId) {
        const modal = ensureNewsModal();
        const head = document.getElementById('rwNewsModalHead');
        const body = document.getElementById('rwNewsModalBody');
        head.innerHTML = `<div class="font-heading font-bold text-white">ข่าวสารระเบียบ</div>`;
        body.innerHTML = loadingBox('กำลังโหลดข้อมูล...');
        modal.classList.remove('hidden');

        try {
            const d = await ensureData();
            const newsList = (d && d.news) || [];
            const item = newsId ? newsList.find(n => n.id === newsId) : newsList[0];
            if (!item) {
                body.innerHTML = `<p class="text-sm text-slate-600">ไม่พบข่าวที่ต้องการ อาจถูกนำออกแล้ว</p>`;
                return;
            }

            head.innerHTML = `
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-heading font-semibold bg-amber-400 text-slate-900 shadow-sm">${escapeHtml(item.badge || 'ประกาศ')}</span>
                    <span class="text-[11px] text-purple-200">${escapeHtml(item.date || '')}</span>
                </div>
                <h2 class="font-heading font-bold text-sm sm:text-base text-white leading-snug">${escapeHtml(item.title)}</h2>
                <div class="text-[11px] text-amber-200/90 font-medium">${escapeHtml(item.ref || '')}</div>
            `;

            body.innerHTML = `
                <!-- Warning / Restriction Alert -->
                <div class="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                    <div class="font-heading font-bold flex items-center gap-1.5 text-xs sm:text-sm">
                        <i class="fa-solid fa-triangle-exclamation text-rose-600"></i>
                        <span>ข้อกำหนดสำคัญ: เฉพาะความจำเป็นทางการแพทย์เพื่อรักษาโรค</span>
                    </div>
                    <p class="text-[11px] sm:text-xs leading-relaxed text-rose-800">
                        ${escapeHtml(item.restriction || 'ไม่รวมถึงการรักษาเพื่อความสวยงาม')}
                    </p>
                </div>

                <!-- Summary Box -->
                <div class="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 text-slate-700 leading-relaxed text-xs">
                    ${escapeHtml(item.summary || '')}
                </div>

                <!-- Criteria Cards -->
                <div class="space-y-2.5">
                    <h3 class="font-heading font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
                        <i class="fa-solid fa-clipboard-check text-pea-700"></i>
                        <span>หลักเกณฑ์การพิจารณาเบิกจ่าย</span>
                    </h3>
                    ${(item.criteria || []).map(c => `
                        <div class="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
                            <div class="font-heading font-semibold text-xs text-pea-900">${escapeHtml(c.title)}</div>
                            ${c.items && c.items.length ? `
                                <ul class="space-y-1.5 list-disc pl-5 text-[11px] sm:text-xs text-slate-600 leading-relaxed">
                                    ${c.items.map(it => `<li>${escapeHtml(it)}</li>`).join('')}
                                </ul>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>

                <!-- Requirement Note -->
                <div class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                    <i class="fa-solid fa-file-medical text-amber-600 mt-0.5 text-sm shrink-0"></i>
                    <div>
                        <strong>ข้อกำหนดในใบรับรองแพทย์:</strong>
                        <span>${escapeHtml(item.requirement || '')}</span>
                    </div>
                </div>

                <!-- Signer & Contact Footer Info -->
                <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div><strong>ผู้ลงนาม:</strong> ${escapeHtml(item.signer || '')}</div>
                    <div><i class="fa-solid fa-phone mr-1 text-pea-700"></i><strong>ติดต่อ:</strong> ${escapeHtml(item.contact || '')}</div>
                </div>
            `;
        } catch (err) {
            body.innerHTML = errorBox(err.message, 'openNewsModal');
        }
    }

    function closeNewsModal() {
        const modal = document.getElementById('rwNewsModal');
        if (modal) modal.classList.add('hidden');
    }

    // ---------- Floating AI Chatbot Widget Logic ----------
    // ประวัติแชตเก็บในเครื่องผู้ใช้ (localStorage) — เปลี่ยนหน้า/รีเฟรชแล้วยังอยู่ · เก็บ 30 ข้อความล่าสุด 7 วัน · ปุ่มล้างแชตลบทิ้ง
    const CHAT_STORE_KEY = 'rw_chat_v1';
    const CHAT_STORE_MAX = 30;
    const CHAT_STORE_DAYS = 7;
    let floatingChatHistory = loadChatHistory();

    function loadChatHistory() {
        try {
            const saved = JSON.parse(localStorage.getItem(CHAT_STORE_KEY) || 'null');
            if (!saved || !Array.isArray(saved.history) || Date.now() - saved.at > CHAT_STORE_DAYS * 864e5) return [];
            return saved.history.filter(m => (m.role === 'user' || m.role === 'model') && m.parts && typeof m.parts[0].text === 'string');
        } catch (e) { return []; }
    }

    function saveChatHistory() {
        floatingChatHistory = floatingChatHistory.slice(-CHAT_STORE_MAX);
        try {
            if (floatingChatHistory.length) localStorage.setItem(CHAT_STORE_KEY, JSON.stringify({ at: Date.now(), history: floatingChatHistory }));
            else localStorage.removeItem(CHAT_STORE_KEY);
        } catch (e) { /* storage เต็มหรือถูกบล็อก — แชตยังใช้ได้ แค่ไม่จำ */ }
    }

    const userBubbleHtml = (text) => `
            <div class="max-w-[85%] bg-pea-700 text-white rounded-2xl rounded-tr-sm px-3.5 py-2 text-xs shadow-sm leading-relaxed">
                ${escapeHtml(text)}
            </div>`;
    const botBubbleHtml = (text) => `
                <div class="w-7 h-7 rounded-lg bg-pea-700 text-amber-300 flex items-center justify-center text-xs shrink-0 mt-0.5">
                    <i class="fa-solid fa-robot"></i>
                </div>
                <div class="max-w-[88%] bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-3 text-xs text-slate-700 shadow-sm leading-relaxed">
                    ${formatChatText(text)}
                </div>`;

    function appendChatBubble(msgBox, role, text) {
        const el = document.createElement('div');
        el.className = role === 'user' ? 'flex justify-end' : 'flex items-start gap-2.5';
        el.innerHTML = role === 'user' ? userBubbleHtml(text) : botBubbleHtml(text);
        msgBox.appendChild(el);
        return el;
    }

    // แสดงแชตที่ค้างไว้ต่อท้ายข้อความต้อนรับ (เรียกเมื่อหน้าโหลดเสร็จ)
    function restoreChat() {
        const msgBox = document.getElementById('rwFloatingChatMessages');
        if (!msgBox || !floatingChatHistory.length) return;
        floatingChatHistory.forEach(m => appendChatBubble(msgBox, m.role, m.parts[0].text));
        msgBox.scrollTop = msgBox.scrollHeight;
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restoreChat);
    else restoreChat();

    function toggleChat(forceOpen) {
        const panel = document.getElementById('rwChatPanel');
        const fab = document.getElementById('rwChatFab');
        if (!panel || !fab) return;
        const isHidden = panel.classList.contains('hidden');
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isHidden;
        if (shouldOpen) {
            panel.classList.remove('hidden');
            fab.classList.add('hidden');
            setTimeout(() => document.getElementById('rwFloatingChatInput')?.focus({ preventScroll: true }), 100);
        } else {
            panel.classList.add('hidden');
            fab.classList.remove('hidden');
        }
    }

    function clearChat() {
        floatingChatHistory = [];
        saveChatHistory();
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

        appendChatBubble(msgBox, 'user', userText);

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
            saveChatHistory();

            loadingBubble.innerHTML = botBubbleHtml(answerText);
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
            input.focus({ preventScroll: true });
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

    function showImage(src, title) {
        const modal = document.getElementById('rwImageModal');
        const img = document.getElementById('rwImageModalImg');
        const t = document.getElementById('rwImageModalTitle');
        const dl = document.getElementById('rwImageModalDownload');
        if (!modal || !img) {
            window.open(src, '_blank');
            return;
        }
        img.src = src;
        if (t) t.textContent = title || 'รูปภาพประกอบ';
        if (dl) dl.href = src;
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeImageModal() {
        const modal = document.getElementById('rwImageModal');
        if (modal) modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    return {
        config: cfg,
        get data() { return data; },
        loadData, ensureData, post, go, back, pageUrl,
        escapeHtml, fmt, errorBox, loadingBox, skeleton,
        openClause, closeClause,
        openNewsModal, closeNewsModal,
        toggleChat, clearChat, askQuestion, handleChatSubmit,
        openFeedback, closeFeedback, submitFeedback,
        showImage, closeImageModal
    };
})();

// ชื่อเดิมที่ยังถูกเรียกจาก onclick ในเนื้อหาข้อคู่มือ / การ์ดสรุป
function switchMainView(view) { RW.go(view); }
function jumpToClause(num) { RW.openClause(num); }
function openFeedbackModal() { RW.openFeedback(); }
function closeFeedbackModal() { RW.closeFeedback(); }
function showImage(src, title) { RW.showImage(src, title); }
function closeImageModal() { RW.closeImageModal(); }
