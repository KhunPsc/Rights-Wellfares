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
        input.focus();
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

// ชั้นหนังสือ: การ์ดละเล่ม → หน้า book (สารบัญ) — เก็บ id ใน localStorage เผื่อ Google Sites ตัด query string
function renderBookShelf(books) {
    const shelf = document.getElementById('homeBookShelf');
    if (!shelf) return;
    const base = RW.pageUrl('book') || 'book.html';
    shelf.innerHTML = books.map(b => {
        const ready = b.chapters.filter(c => c.content || c.link || c.clauses).length;
        return `
        <a href="${base}?book=${encodeURIComponent(b.id)}" onclick="try{localStorage.setItem('rw_book','${b.id}|0')}catch(e){}"
           class="group relative bg-gradient-to-br from-pea-900 via-pea-700 to-purple-800 rounded-2xl p-5 pl-7 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition no-underline block overflow-hidden">
            <span class="absolute left-0 top-0 bottom-0 w-3 bg-black/20"></span>
            <div class="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-xl text-amber-300 mb-3"><i class="fa-solid ${b.icon || 'fa-book'}"></i></div>
            <span class="px-2 py-0.5 text-[11px] font-heading font-semibold bg-amber-400 text-slate-900 rounded-full">${RW.escapeHtml(b.short || '')}</span>
            <h3 class="mt-2 font-heading font-bold text-base leading-snug">${RW.escapeHtml(b.title)}</h3>
            <p class="mt-1 text-[11px] text-purple-200 line-clamp-2">${RW.escapeHtml(b.subtitle || '')}</p>
            <div class="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs font-heading">
                <span class="text-purple-100">${b.chapters.length} บท · พร้อมอ่าน ${ready}</span>
                <span class="text-amber-300 font-semibold">เปิดอ่าน <i class="fa-solid fa-arrow-right group-hover:translate-x-1 transition"></i></span>
            </div>
        </a>`;
    }).join('');
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

    }).catch(err => {
        const shelf = document.getElementById('homeBookShelf');
        if (shelf) shelf.innerHTML = RW.errorBox(err.message, 'initHomePage');
    });
}

initHomePage();
