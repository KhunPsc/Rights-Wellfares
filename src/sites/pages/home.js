// หน้าแรก: โหลด Categories เพื่อแสดงหมวดหมู่ระเบียบ และ News Feed
function initHomePage() {
    const grid = document.getElementById('homeCategoryGrid');
    grid.innerHTML = RW.loadingBox('กำลังโหลดรายการหมวดหมู่...');

    RW.loadData(d => {
        // News Feed / Announcement Ticker
        const newsList = d.news || [];
        const newsSection = document.getElementById('newsFeedSection');
        const newsHeadline = document.getElementById('newsTickerHeadline');
        if (newsSection && newsHeadline && newsList.length > 0) {
            const latest = newsList[0];
            newsHeadline.innerHTML = `
                <span class="text-amber-800 font-bold mr-1.5">[${RW.escapeHtml(latest.date)}]</span>
                <span>${RW.escapeHtml(latest.title)}</span>
                <span class="text-[11px] text-slate-500 ml-1">(${RW.escapeHtml(latest.ref)})</span>
            `;
            newsSection.classList.remove('hidden');
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
                        ${c.clauses ? c.clauses.length : 0} ข้อ
                    </div>
                </div>
            </a>
        `).join('');
    }).catch(err => {
        grid.innerHTML = RW.errorBox(err.message, 'initHomePage');
    });
}

initHomePage();
