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

// Expose navigation functions
window.nextNewsSlide = nextNewsSlide;
window.prevNewsSlide = prevNewsSlide;
window.goToNewsSlide = goToNewsSlide;

function initHomePage() {
    const grid = document.getElementById('homeCategoryGrid');
    grid.innerHTML = RW.loadingBox('กำลังโหลดรายการหมวดหมู่...');

    RW.loadData(d => {
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

        const cats = (d.categories || []).filter(c => c.id !== 'all');
        const manualUrl = RW.pageUrl('manual') || 'manual.html';
        grid.innerHTML = cats.map(c => `
            <a
                href="${manualUrl}?cat=${encodeURIComponent(c.id)}"
                onclick="try{localStorage.setItem('rw_selected_cat','${c.id}')}catch(e){}"
                class="cursor-pointer p-3.5 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition flex items-start gap-3 group block no-underline"
            >
                <div class="w-9 h-9 rounded-lg bg-purple-100 text-pea-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <i class="fa-solid ${c.icon}"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <div class="font-heading font-semibold text-xs text-slate-800 truncate group-hover:text-pea-800 transition">
                        ${RW.escapeHtml(c.shortName)}
                    </div>
                    <div class="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                        ${RW.escapeHtml(c.desc)}
                    </div>
                    <div class="mt-1.5 text-[10px] font-heading font-medium text-pea-700">
                        ${c.clauses ? c.clauses.length : 0} ${c.id === 'cat-guidelines' ? 'เรื่อง' : 'ข้อ'}
                    </div>
                </div>
            </a>
        `).join('');
    }).catch(err => {
        grid.innerHTML = RW.errorBox(err.message, 'initHomePage');
    });
}

initHomePage();
