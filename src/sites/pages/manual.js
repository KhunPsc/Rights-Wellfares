// หน้า: คู่มือ 44 ข้อ — ข้อมูลมาจาก Apps Script (src/data/clauses.json, categories.json, forms.json)
const PAGE_SIZE = 10;

let CATEGORIES = [];
let CLAUSES_DATA = [];
let currentCategory = 'all';
let currentSearchQuery = '';
let currentPage = 1;
let searchInputComposing = false;
let expandedClauses = new Set([1, 7, 8, 14, 43, 44]);

// Render Sidebar Categories
function renderCategorySidebar() {
    const nav = document.getElementById('categoryNavList');
    document.getElementById('categoryCountLabel').textContent = `${CATEGORIES.filter(c => c.id !== 'all').length} หมวดหลัก`;
    nav.innerHTML = CATEGORIES.map(cat => {
        const count = cat.id === 'all' ? CLAUSES_DATA.length : cat.clauses.length;
        const isActive = currentCategory === cat.id;
        return `
            <button
                onclick="selectCategory('${cat.id}')"
                class="w-full text-left px-3 py-2.5 rounded-xl text-xs sm:text-sm font-heading transition flex items-center justify-between ${
                    isActive
                        ? 'bg-pea-700 text-white font-semibold shadow-sm'
                        : 'text-slate-700 hover:bg-purple-50 hover:text-pea-800'
                }"
            >
                <span class="flex items-center gap-2.5 truncate">
                    <i class="fa-solid ${cat.icon} w-4 text-center ${isActive ? 'text-amber-300' : 'text-pea-600'}"></i>
                    <span class="truncate">${cat.shortName}</span>
                </span>
                <span class="px-2 py-0.5 rounded-full text-[11px] ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }">${count} ข้อ</span>
            </button>
        `;
    }).join('');
}

function renderForms(forms) {
    const list = (forms || []).filter(f => f.url);
    document.getElementById('formsSection').classList.toggle('hidden', list.length === 0);
    document.getElementById('formsList').innerHTML = list.map(f => `
        <a
            href="${RW.escapeHtml(f.url)}"
            target="_blank"
            rel="noopener"
            class="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-pea-800 transition hover:border-pea-300 hover:bg-purple-50"
        >
            <i class="fa-regular ${f.type === 'word' ? 'fa-file-word text-blue-600' : 'fa-file-pdf text-rose-600'} mt-0.5"></i>
            <span>${RW.escapeHtml(f.label)}</span>
        </a>
    `).join('');
}

// Select Category
function selectCategory(catId) {
    currentCategory = catId;
    currentPage = 1;
    renderCategorySidebar();

    const catObj = CATEGORIES.find(c => c.id === catId);
    document.getElementById('activeCatBadge').textContent = catObj.name;
    document.getElementById('activeCatTitle').textContent = catObj.name;
    document.getElementById('activeCatDesc').textContent = catObj.desc;

    renderClausesList();
    document.getElementById('activeCategoryHeader').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Highlight search terms safely
function highlightText(htmlStr, query) {
    if (!query || query.trim().length < 1) return htmlStr;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?![^<]*>)(${escaped})`, 'gi');
    return htmlStr.replace(regex, '<mark class="highlight-mark">$1</mark>');
}

function getFilteredClauses() {
    const catObj = CATEGORIES.find(c => c.id === currentCategory);
    return CLAUSES_DATA.filter(item => {
        const matchCat = currentCategory === 'all' || (catObj && catObj.clauses && catObj.clauses.includes(item.num));
        if (!matchCat) return false;
        if (!currentSearchQuery) return true;
        const q = currentSearchQuery.toLowerCase();
        const plainContent = item.content.replace(/<[^>]+>/g, ' ').toLowerCase();
        return (
            `ข้อ ${item.num}`.includes(q) ||
            item.title.toLowerCase().includes(q) ||
            item.summary.toLowerCase().includes(q) ||
            plainContent.includes(q)
        );
    });
}

// Render Clauses List (แบ่งหน้าละ PAGE_SIZE ข้อ)
function renderClausesList() {
    const container = document.getElementById('clausesContainer');
    const filtered = getFilteredClauses();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);

    document.getElementById('clauseCounterBadge').textContent = `แสดง ${filtered.length} / ${CLAUSES_DATA.length} ข้อ`;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <i class="fa-solid fa-magnifying-glass text-3xl text-slate-300 mb-2"></i>
                <h3 class="font-heading font-bold text-slate-700">ไม่พบข้อระเบียบที่ตรงกับคำค้นหา "${RW.escapeHtml(currentSearchQuery)}"</h3>
                <p class="text-xs text-slate-500 mt-1">ลองค้นหาด้วยคำสำคัญอื่น หรือกดปุ่มล้างคำค้นหา</p>
                <button onclick="clearSearch()" class="mt-4 px-4 py-2 rounded-xl bg-pea-700 text-white text-xs font-heading font-semibold">
                    แสดงทุกข้อทั้งหมด
                </button>
            </div>
        `;
        renderPager(0);
        return;
    }

    const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    container.innerHTML = pageItems.map(item => {
        const isExpanded = expandedClauses.has(item.num) || currentSearchQuery.length > 0;
        const catName = CATEGORIES.find(c => c.id === item.cat)?.shortName || '';
        const titleHtml = highlightText(item.title, currentSearchQuery);
        const summaryHtml = highlightText(item.summary, currentSearchQuery);
        const bodyHtml = highlightText(item.content, currentSearchQuery);

        return `
            <article id="clause-card-${item.num}" class="clause-card bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <button
                    onclick="toggleClause(${item.num})"
                    class="w-full text-left p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-slate-50/80 transition"
                >
                    <div class="flex items-start gap-3.5">
                        <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-pea-700 to-purple-800 text-white font-heading font-bold text-sm flex flex-col items-center justify-center shrink-0 shadow-sm">
                            <span class="text-[10px] font-normal text-purple-200 leading-none">ข้อ</span>
                            <span class="text-base leading-tight">${item.num}</span>
                        </div>
                        <div>
                            <div class="flex flex-wrap items-center gap-2 mb-1">
                                <span class="px-2 py-0.5 rounded-md bg-purple-100 text-pea-800 font-heading font-semibold text-[11px]">${catName}</span>
                                <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px]"><i class="fa-regular fa-file-pdf mr-1"></i>${item.page}</span>
                            </div>
                            <h3 class="font-heading font-bold text-slate-900 text-sm sm:text-base">${titleHtml}</h3>
                            <p class="text-xs text-slate-500 mt-0.5">${summaryHtml}</p>
                        </div>
                    </div>
                    <div class="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 mt-1">
                        <i class="fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-xs"></i>
                    </div>
                </button>
                <div class="${isExpanded ? 'block' : 'hidden'} px-4 sm:px-5 pb-5 pt-2 border-t border-slate-100 bg-white">
                    ${bodyHtml}
                </div>
            </article>
        `;
    }).join('');

    renderPager(totalPages);
}

function renderPager(totalPages) {
    const pager = document.getElementById('clausePager');
    if (totalPages <= 1) {
        pager.innerHTML = '';
        return;
    }
    const btn = (label, page, { active = false, disabled = false } = {}) => `
        <button
            ${disabled ? 'disabled' : `onclick="goToPage(${page})"`}
            class="clause-page-btn px-3 py-1.5 rounded-xl text-xs font-heading font-semibold border transition ${
                active
                    ? 'bg-pea-700 border-pea-700 text-white shadow-sm'
                    : disabled
                        ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-purple-50 hover:text-pea-800'
            }"
        >${label}</button>`;

    let html = btn('<i class="fa-solid fa-chevron-left"></i>', currentPage - 1, { disabled: currentPage === 1 });
    for (let p = 1; p <= totalPages; p++) html += btn(p, p, { active: p === currentPage });
    html += btn('<i class="fa-solid fa-chevron-right"></i>', currentPage + 1, { disabled: currentPage === totalPages });
    pager.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    renderClausesList();
    document.getElementById('activeCategoryHeader').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleClause(num) {
    if (expandedClauses.has(num)) {
        expandedClauses.delete(num);
    } else {
        expandedClauses.add(num);
    }
    renderClausesList();
}

function toggleAllClauses(expand) {
    if (expand) {
        CLAUSES_DATA.forEach(c => expandedClauses.add(c.num));
    } else {
        expandedClauses.clear();
    }
    renderClausesList();
}

// override core.js: ในหน้านี้เลื่อนไปที่การ์ดแทนการเปิด popup
function jumpToClause(num) {
    if (!CLAUSES_DATA.length) return RW.openClause(num);
    if (currentCategory !== 'all' || currentSearchQuery) {
        currentCategory = 'all';
        document.getElementById('globalSearchInput').value = '';
        currentSearchQuery = '';
        document.getElementById('clearSearchBtn').classList.add('hidden');
        selectCategory('all');
    }
    const idx = CLAUSES_DATA.findIndex(c => c.num === num);
    if (idx < 0) return;
    currentPage = Math.floor(idx / PAGE_SIZE) + 1;
    expandedClauses.add(num);
    renderClausesList();
    setTimeout(() => {
        const el = document.getElementById(`clause-card-${num}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-pea-600');
            setTimeout(() => el.classList.remove('ring-2', 'ring-pea-600'), 2200);
        }
    }, 80);
}

function handleSearchInput(event, input) {
    if (searchInputComposing || event.isComposing) return;
    handleSearch(input.value);
}

function handleSearchCompositionEnd(input) {
    searchInputComposing = false;
    handleSearch(input.value);
}

function handleSearch(val) {
    const query = val.trim();
    if (query === currentSearchQuery) return;
    currentSearchQuery = query;
    currentPage = 1;
    document.getElementById('clearSearchBtn').classList.toggle('hidden', currentSearchQuery.length === 0);
    renderClausesList();
}

function clearSearch() {
    document.getElementById('globalSearchInput').value = '';
    handleSearch('');
}

function initManualPage() {
    document.getElementById('clausesContainer').innerHTML = RW.loadingBox('กำลังโหลดเนื้อหาคู่มือ...');
    RW.loadData(d => {
        CATEGORIES = d.categories;
        CLAUSES_DATA = d.clauses;

        // Check if category was passed from another page via localStorage or URL
        let targetCat = null;
        try {
            targetCat = localStorage.getItem('rw_selected_cat');
            if (targetCat) localStorage.removeItem('rw_selected_cat');
        } catch (e) {}
        if (!targetCat) {
            const urlParams = new URLSearchParams(window.location.search);
            targetCat = urlParams.get('cat') || window.location.hash.replace('#', '');
        }

        if (targetCat && CATEGORIES.some(c => c.id === targetCat)) {
            currentCategory = targetCat;
            const catObj = CATEGORIES.find(c => c.id === currentCategory);
            if (catObj) {
                document.getElementById('activeCatBadge').textContent = catObj.name;
                document.getElementById('activeCatTitle').textContent = catObj.name;
                document.getElementById('activeCatDesc').textContent = catObj.desc;
            }
        } else if (!CATEGORIES.some(c => c.id === currentCategory)) {
            currentCategory = 'all';
        }

        renderCategorySidebar();
        renderForms(d.forms);
        renderClausesList();

        // Check if a specific clause was passed
        try {
            const targetClause = localStorage.getItem('rw_selected_clause');
            if (targetClause) {
                localStorage.removeItem('rw_selected_clause');
                setTimeout(() => jumpToClause(Number(targetClause)), 350);
            }
        } catch (e) {}
    }).catch(err => {
        document.getElementById('clauseCounterBadge').textContent = 'โหลดไม่สำเร็จ';
        document.getElementById('clausesContainer').innerHTML = RW.errorBox(err.message, 'initManualPage');
    });
}

const searchInput = document.getElementById('globalSearchInput');
searchInput.addEventListener('input', event => handleSearchInput(event, searchInput));
searchInput.addEventListener('compositionstart', () => { searchInputComposing = true; });
searchInput.addEventListener('compositionend', () => handleSearchCompositionEnd(searchInput));

initManualPage();
