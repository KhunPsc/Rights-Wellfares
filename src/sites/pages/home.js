// หน้าแรก: โหลด Categories เพื่อแสดงหมวดหมู่ระเบียบ และ News Feed Banner Carousel
let newsItems = [];
let currentNewsIndex = 0;
let newsCarouselTimer = null;
const CAROUSEL_INTERVAL = 5500; // 5.5 วินาทีต่อการเปลี่ยนสไลด์

function renderNewsSlide(index) {
    if (!newsItems.length) return;
    currentNewsIndex = (index + newsItems.length) % newsItems.length;
    const item = newsItems[currentNewsIndex];

    const container = document.getElementById('newsSlideContainer');
    const content = document.getElementById('newsSlideContent');
    const badge = document.getElementById('newsSlideBadge');
    const counter = document.getElementById('newsSlideCounter');
    const dotsContainer = document.getElementById('newsOwlDots');

    if (badge) badge.textContent = item.badge || 'ประกาศ';
    if (counter) counter.textContent = `${currentNewsIndex + 1} / ${newsItems.length}`;

    // Smooth fade transition
    if (container) {
        container.style.opacity = '0';
        setTimeout(() => {
            if (content) {
                content.innerHTML = `
                    <div class="flex items-center gap-2 flex-wrap text-xs text-purple-200">
                        <span class="text-amber-400 font-heading font-semibold flex items-center gap-1">
                            <i class="fa-regular fa-calendar-check text-[11px]"></i>
                            <span>${RW.escapeHtml(item.date || '')}</span>
                        </span>
                        <span class="text-white/40">•</span>
                        <span class="text-purple-200/90 font-medium truncate max-w-xs sm:max-w-md">${RW.escapeHtml(item.ref || '')}</span>
                    </div>

                    <h2
                        class="text-base sm:text-lg font-heading font-bold text-white hover:text-amber-300 transition cursor-pointer leading-snug line-clamp-2"
                        onclick="RW.openNewsModal('${item.id}')"
                        title="คลิกเพื่ออ่านรายละเอียดฉบับเต็ม"
                    >
                        ${RW.escapeHtml(item.title || '')}
                    </h2>

                    <p class="text-xs sm:text-sm text-purple-100/80 line-clamp-2 leading-relaxed">
                        ${RW.escapeHtml(item.summary || '')}
                    </p>

                    <div class="pt-2 flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onclick="RW.openNewsModal('${item.id}')"
                            class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-heading font-semibold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                            <span>อ่านรายละเอียดฉบับเต็ม</span>
                            <i class="fa-solid fa-arrow-right text-[10px]"></i>
                        </button>
                        <span class="text-[11px] text-purple-300/70 hidden sm:inline-block">
                            (คลิกเพื่อดูเงื่อนไขและเอกสารแนบ)
                        </span>
                    </div>
                `;
            }
            container.style.opacity = '1';
        }, 150);
    }

    // Render Owl Dots
    if (dotsContainer) {
        dotsContainer.innerHTML = newsItems.map((_, i) => `
            <button
                type="button"
                onclick="goToNewsSlide(${i})"
                class="${i === currentNewsIndex ? 'w-7 h-2 rounded-full bg-amber-400 shadow' : 'w-2 h-2 rounded-full bg-white/30 hover:bg-white/60'} transition-all duration-300 cursor-pointer"
                title="ไปยังข่าวที่ ${i + 1}"
            ></button>
        `).join('');
    }
}

function nextNewsSlide() {
    renderNewsSlide(currentNewsIndex + 1);
    resetNewsTimer();
}

function prevNewsSlide() {
    renderNewsSlide(currentNewsIndex - 1);
    resetNewsTimer();
}

function goToNewsSlide(idx) {
    renderNewsSlide(idx);
    resetNewsTimer();
}

function startNewsTimer() {
    if (newsCarouselTimer) clearInterval(newsCarouselTimer);
    if (newsItems.length > 1) {
        newsCarouselTimer = setInterval(() => {
            renderNewsSlide(currentNewsIndex + 1);
        }, CAROUSEL_INTERVAL);
    }
}

function stopNewsTimer() {
    if (newsCarouselTimer) {
        clearInterval(newsCarouselTimer);
        newsCarouselTimer = null;
    }
}

function resetNewsTimer() {
    stopNewsTimer();
    startNewsTimer();
}

// ค้นหาในหนังสือทุกเล่ม (เนื้อหาบท + ข้อในเล่ม 44 ข้อ) แสดงผลใต้ช่องค้นหา
let HOME_DATA = null;
const plainText = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

function searchBooks(q) {
    const needle = q.toLowerCase();
    const hits = [];
    for (const b of HOME_DATA.books || []) {
        for (const ch of b.chapters) {
            const items = ch.clauses
                ? ch.clauses.map(n => HOME_DATA.clauses.find(c => String(c.num) === String(n))).filter(Boolean)
                    .map(c => ({ clause: String(c.num), title: (typeof c.num === 'number' ? 'ข้อ ' + c.num + ' ' : '') + c.title, text: c.title + ' ' + c.summary + ' ' + plainText(c.content) }))
                : [{ clause: '', title: ch.title, text: ch.title + ' ' + plainText(ch.content) }];
            for (const it of items) {
                const i = it.text.toLowerCase().indexOf(needle);
                if (i < 0) continue;
                const start = Math.max(0, i - 40);
                hits.push({ book: b, ch, clause: it.clause, title: it.title, snippet: (start ? '…' : '') + it.text.slice(start, i + needle.length + 80) + '…', at: i });
            }
        }
    }
    return hits;
}

function handleHomeSearch(event) {
    if (event) event.preventDefault();
    const input = document.getElementById('globalSearchInput');
    const box = document.getElementById('homeSearchResults');
    const q = (input ? input.value : '').trim();
    if (!q || !HOME_DATA || !box) return;
    const hits = searchBooks(q);
    const base = RW.pageUrl('book') || 'book.html';
    const mark = (s) => RW.escapeHtml(s).replace(new RegExp(RW.escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark class="bg-amber-200 rounded px-0.5">${m}</mark>`);
    box.innerHTML = `
        <div class="px-4 py-2.5 border-b border-slate-100 text-xs text-slate-500 font-heading">พบ ${hits.length} รายการสำหรับ "${RW.escapeHtml(q)}"${hits.length > 30 ? ' (แสดง 30 รายการแรก)' : ''}</div>
        ${hits.length ? `<ul class="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">${hits.slice(0, 30).map(h => {
            const key = `${h.book.id}|${h.ch.num}|${h.clause}`;
            return `<li><a href="${base}?book=${encodeURIComponent(h.book.id)}&ch=${h.ch.num}${h.clause ? '&clause=' + encodeURIComponent(h.clause) : ''}" onclick="try{localStorage.setItem('rw_book','${key}')}catch(e){}" class="block px-4 py-3 hover:bg-purple-50/60 no-underline">
                <span class="block text-[11px] text-pea-600 font-heading font-semibold">${RW.escapeHtml(h.book.short)} · บทที่ ${h.ch.num} ${RW.escapeHtml(h.ch.title)}</span>
                <span class="block text-sm font-heading font-semibold text-slate-800">${mark(h.title)}</span>
                <span class="block text-xs text-slate-500 mt-0.5 line-clamp-2">${mark(h.snippet)}</span></a></li>`;
        }).join('')}</ul>` : '<p class="px-4 py-6 text-center text-sm text-slate-500">ไม่พบ — ลองคำอื่น หรือถาม AI ผู้ช่วย</p>'}`;
    box.classList.remove('hidden');
}

function clearHomeSearch() {
    const input = document.getElementById('globalSearchInput');
    if (input) {
        input.value = '';
        input.focus({ preventScroll: true });
    }
    const btn = document.getElementById('clearSearchBtn');
    if (btn) btn.classList.add('hidden');
    const box = document.getElementById('homeSearchResults');
    if (box) box.classList.add('hidden');
}

// Expose navigation & search functions
window.nextNewsSlide = nextNewsSlide;
window.prevNewsSlide = prevNewsSlide;
window.goToNewsSlide = goToNewsSlide;
window.handleHomeSearch = handleHomeSearch;
window.clearHomeSearch = clearHomeSearch;

// ปกหนังสือ: พื้นขาว + แถบโค้งสีเข้มพาดครึ่งล่าง + เส้นคาด — วนสีตามลำดับเล่ม
// แถบโค้งเริ่มไม่ต่ำกว่า 45% ของความสูงปก ข้อความชิดล่างจึงอยู่บนแถบเสมอ (ตัวหนังสือไม่กลืนกับพื้นขาว)
const COVER_THEMES = [
    { fill: '#5b1968', band: '#f59e0b', streak: '#ffffff', text: 'text-white', sub: 'text-purple-100', badge: 'bg-amber-400 text-slate-900', line: 'border-white/25', icon: 'bg-pea-800 text-amber-300' },
    { fill: '#111827', band: '#facc15', streak: '#ffffff', text: 'text-white', sub: 'text-slate-300', badge: 'bg-yellow-400 text-slate-900', line: 'border-white/20', icon: 'bg-slate-900 text-yellow-400' },
    { fill: '#f59e0b', band: '#5b1968', streak: '#ffffff', text: 'text-slate-950', sub: 'text-slate-900', badge: 'bg-pea-800 text-white', line: 'border-black/20', icon: 'bg-amber-500 text-slate-950' },
];

function coverArt(t) {
    return `<svg class="absolute inset-0 w-full h-full" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 180 C55 178 85 148 130 132 C185 112 245 108 300 98 L300 400 L0 400 Z" fill="${t.fill}"/>
                <path d="M0 168 C55 166 85 136 130 120 C185 100 245 96 300 86" fill="none" stroke="${t.band}" stroke-width="7"/>
                <path d="M0 154 C60 152 90 126 135 110 C190 91 245 86 300 76" fill="none" stroke="${t.band}" stroke-width="2" opacity=".6"/>
                <g fill="${t.streak}" opacity=".14">
                    <path d="M-10 330 C40 300 90 285 150 280 C100 295 50 320 -10 360 Z"/>
                    <path d="M20 400 C60 350 110 325 190 312 C130 335 85 365 60 400 Z"/>
                    <path d="M150 400 C175 375 215 360 260 352 C225 368 200 385 190 400 Z"/>
                </g>
            </svg>`;
}

// ชั้นหนังสือ: การ์ดละเล่ม → หน้า book (สารบัญ) — เก็บ id ใน localStorage เผื่อ Google Sites ตัด query string
function renderBookShelf(books) {
    const shelf = document.getElementById('homeBookShelf');
    if (!shelf) return;
    shelf.removeAttribute('aria-busy');
    const base = RW.pageUrl('book') || 'book.html';
    shelf.innerHTML = books.map((b, i) => {
        const ready = b.chapters.filter(c => c.content || c.link || c.clauses).length;
        const t = COVER_THEMES[i % COVER_THEMES.length];
        return `
        <a href="${base}?book=${encodeURIComponent(b.id)}" onclick="try{localStorage.setItem('rw_book','${b.id}|0')}catch(e){}"
           class="group relative aspect-[3/4] flex flex-col bg-white rounded-r-2xl rounded-l-md p-4 pl-6 sm:p-5 sm:pl-7 border border-slate-200 shadow-md hover:shadow-xl hover:-translate-y-1 transition no-underline overflow-hidden">
            ${coverArt(t)}
            <span class="absolute left-0 top-0 bottom-0 w-3 bg-black/10 border-r border-black/10"></span>
            <div class="relative flex items-start justify-between gap-2">
                <span class="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl ${t.icon} flex items-center justify-center text-base sm:text-lg"><i class="fa-solid ${b.icon || 'fa-book'}"></i></span>
                <span class="px-2 py-0.5 text-[11px] font-heading font-semibold ${t.badge} rounded-full whitespace-nowrap">${RW.escapeHtml(b.short || '')}</span>
            </div>
            <div class="relative mt-auto text-right ${t.text}" title="${RW.escapeHtml(b.subtitle || '')}">
                <h3 class="font-heading font-extrabold text-sm sm:text-base leading-snug line-clamp-3">${RW.escapeHtml(b.title)}</h3>
                <div class="mt-2 pt-2 border-t ${t.line} flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] sm:text-xs font-heading">
                    <span class="${t.sub}">${b.chapters.length} บท<span class="hidden lg:inline"> · พร้อมอ่าน ${ready}</span></span>
                    <span class="font-semibold">เปิดอ่าน <i class="fa-solid fa-arrow-right group-hover:translate-x-1 transition"></i></span>
                </div>
            </div>
        </a>`;
    }).join('');
}

// การ์ด "กำลังสงสัยเรื่องอะไรอยู่รึเปล่า?" — สีเขียนเต็มชื่อ class เพื่อให้ Tailwind สร้าง CSS ตอน build
const HIGHLIGHT_COLORS = {
    purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100 [&_.hl-icon]:bg-pea-700',
    pink: 'bg-pink-50 border-pink-200 hover:bg-pink-100 [&_.hl-icon]:bg-pink-600',
    blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100 [&_.hl-icon]:bg-blue-600',
    emerald: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 [&_.hl-icon]:bg-emerald-600',
    indigo: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100 [&_.hl-icon]:bg-indigo-600',
    amber: 'bg-amber-50 border-amber-200 hover:bg-amber-100 [&_.hl-icon]:bg-amber-500',
    orange: 'bg-orange-50 border-orange-200 hover:bg-orange-100 [&_.hl-icon]:bg-orange-500',
    slate: 'bg-slate-50 border-slate-200 hover:bg-slate-100 [&_.hl-icon]:bg-slate-600',
};

function renderHighlights(items) {
    const box = document.getElementById('homeHighlights');
    if (!box) return;
    box.removeAttribute('aria-busy');
    const base = RW.pageUrl('book') || 'book.html';
    box.innerHTML = items.map(h => `
        <a href="${base}?book=${encodeURIComponent(h.book)}&ch=${h.ch}" onclick="try{localStorage.setItem('rw_book','${h.book}|${h.ch}')}catch(e){}"
           class="group p-3 rounded-xl border transition flex items-start gap-2.5 no-underline ${HIGHLIGHT_COLORS[h.color] || HIGHLIGHT_COLORS.slate}">
            <span class="hl-icon w-9 h-9 shrink-0 rounded-lg text-white flex items-center justify-center"><i class="fa-solid ${h.icon}"></i></span>
            <span class="min-w-0">
                <span class="block font-heading font-bold text-sm text-slate-800 leading-snug group-hover:text-pea-800">${RW.escapeHtml(h.title)}</span>
                <span class="block mt-0.5 text-[11px] text-slate-600 leading-snug">${RW.escapeHtml(h.figure)}</span>
            </span>
        </a>`).join('');
}

function initHomePage() {
    // Setup Home Search Input events
    const sInput = document.getElementById('globalSearchInput');
    if (sInput) {
        sInput.addEventListener('input', () => {
            const btn = document.getElementById('clearSearchBtn');
            if (btn) btn.classList.toggle('hidden', sInput.value.trim().length === 0);
        });
    }

    RW.loadData(d => {
        HOME_DATA = d;
        // News Feed / Announcement Banner Carousel (สูงสุด 10 เรื่อง)
        newsItems = (d.news || []).slice(0, 10);
        const newsSection = document.getElementById('newsFeedSection');

        if (newsSection && newsItems.length > 0) {
            renderNewsSlide(0);
            startNewsTimer();

            // Hover pause & resume
            newsSection.addEventListener('mouseenter', stopNewsTimer);
            newsSection.addEventListener('mouseleave', startNewsTimer);

            // Touch swipe support for mobile
            let touchStartX = 0;
            newsSection.addEventListener('touchstart', e => {
                if (e.changedTouches && e.changedTouches[0]) {
                    touchStartX = e.changedTouches[0].screenX;
                }
            }, { passive: true });

            newsSection.addEventListener('touchend', e => {
                if (e.changedTouches && e.changedTouches[0]) {
                    const diff = e.changedTouches[0].screenX - touchStartX;
                    if (diff > 50) prevNewsSlide();
                    else if (diff < -50) nextNewsSlide();
                }
            }, { passive: true });

            newsSection.classList.remove('hidden');
        } else if (newsSection) {
            newsSection.classList.add('hidden');
        }

        renderBookShelf(d.books || []);
        renderHighlights(d.highlights || []);

    }).catch(err => {
        const shelf = document.getElementById('homeBookShelf');
        if (shelf) shelf.innerHTML = RW.errorBox(err.message, 'initHomePage');
        const box = document.getElementById('homeHighlights');
        if (box) box.innerHTML = '';
    });
}

initHomePage();
