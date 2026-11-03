// หน้าอ่านหนังสือ: ?book=<id>&ch=<n>[&clause=<ข้อ>] — สารบัญอยู่ใน sidebar, เปลี่ยนบทในหน้าเดียว (ไม่โหลดใหม่)
// Google Sites ไม่ส่ง query string เข้า embed — จึงเก็บสำรองไว้ใน localStorage 'rw_book' = "<id>|<ch>|<clause>"
let BOOK_DATA = null;

function bookParams() {
    const q = new URLSearchParams(window.location.search);
    if (q.get('book')) return { book: q.get('book'), ch: parseInt(q.get('ch'), 10) || 0, clause: q.get('clause') || '' };
    try {
        const [book, ch, clause] = (localStorage.getItem('rw_book') || '').split('|');
        if (book) return { book, ch: parseInt(ch, 10) || 0, clause: clause || '' };
    } catch (e) { /* storage ถูกบล็อก */ }
    return { book: '', ch: 0, clause: '' };
}

function bookHref(bookId, ch, clause) {
    return `${RW.pageUrl('book') || 'book.html'}?book=${encodeURIComponent(bookId)}&ch=${ch}${clause ? '&clause=' + encodeURIComponent(clause) : ''}`;
}

// ลิงก์ภายในหนังสือ: href ไว้เปิดแท็บใหม่ได้ · คลิกปกติเปลี่ยนบทในหน้าเดิม
function bookLink(bookId, ch, clause) {
    const c = clause ? `, '${RW.escapeHtml(String(clause))}'` : '';
    return `href="${bookHref(bookId, ch, clause)}" onclick="return bookGo('${bookId}', ${ch}${c})"`;
}

function bookGo(bookId, ch, clause) {
    try { localStorage.setItem('rw_book', `${bookId}|${ch}|${clause || ''}`); } catch (e) {}
    try { history.pushState(null, '', bookHref(bookId, ch, clause)); } catch (e) { /* sandbox iframe */ }
    renderBook({ book: bookId, ch, clause });
    return false;
}
window.bookGo = bookGo;

function toolButton(t) {
    return `<a href="${RW.pageUrl(t.page) || t.page + '.html'}" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50 text-xs font-heading font-semibold text-pea-800 transition no-underline">
        <i class="fa-solid ${t.icon || 'fa-arrow-up-right-from-square'}"></i><span>${RW.escapeHtml(t.label)}</span></a>`;
}

// ไปแผนที่ความรู้ที่หัวข้อของบทนี้ (topics มาจาก books.json / categories.json)
function mapButton(topic) {
    const href = `${RW.pageUrl('map') || 'map.html'}?topic=${encodeURIComponent(topic)}`;
    return `<a href="${href}" onclick="try{localStorage.setItem('rw_map_topic',${RW.escapeHtml(JSON.stringify(topic))})}catch(e){}" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50 text-xs font-heading font-semibold text-pea-800 transition no-underline">
        <i class="fa-solid fa-diagram-project"></i><span>ดูในแผนที่ความรู้</span></a>`;
}

const chReady = (c) => c.content || c.link || c.clauses;
const chMeta = (c) => c.clauses ? `${c.clauses.length} ${typeof c.clauses[0] === 'number' ? 'ข้อ' : 'เรื่อง'}` : `หน้า ${RW.escapeHtml(c.pages || '-')}`;

function renderBanner(book, ch, prev, next) {
    const arrow = (c, dir) => c
        ? `<a ${bookLink(book.id, c.num)} class="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 text-white no-underline" title="บทที่ ${c.num} ${RW.escapeHtml(c.title)}"><i class="fa-solid fa-chevron-${dir}"></i></a>`
        : `<span class="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-white/5 text-white/30"><i class="fa-solid fa-chevron-${dir}"></i></span>`;
    return `
    <div class="bg-gradient-to-r from-pea-900 via-pea-700 to-purple-800 rounded-2xl px-4 py-3 text-white shadow-md flex items-center gap-3">
        <span class="hidden sm:inline-flex w-10 h-10 shrink-0 rounded-xl bg-white/10 items-center justify-center text-amber-300"><i class="fa-solid ${book.icon || 'fa-book'}"></i></span>
        <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 min-w-0">
                <span class="shrink-0 px-2 py-0.5 text-[11px] font-heading font-semibold bg-amber-400 text-slate-900 rounded-full">${RW.escapeHtml(book.short || '')}</span>
                <span class="font-heading font-bold text-sm truncate">${RW.escapeHtml(book.title)}</span>
            </div>
            <div class="text-[11px] text-purple-200 mt-0.5 truncate">บทที่ ${ch.num} / ${book.chapters.length} · ${chMeta(ch)} · ${RW.escapeHtml(book.edition || '')}</div>
        </div>
        <button type="button" onclick="bookToc(true)" class="lg:hidden shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-heading font-semibold"><i class="fa-solid fa-list-ol"></i>สารบัญ</button>
        <div class="flex items-center gap-1.5 shrink-0">${arrow(prev, 'left')}${arrow(next, 'right')}</div>
    </div>`;
}

function renderSidebar(book, ch) {
    return `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col max-h-full overflow-hidden">
        <div class="p-3 border-b border-slate-100 flex items-center gap-2">
            <div class="relative flex-1">
                <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input type="search" oninput="bookFilterToc(this)" placeholder="ค้นหาชื่อบท" aria-label="ค้นหาชื่อบท" class="w-full pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 text-sm">
            </div>
            <button type="button" onclick="bookToc(false)" class="lg:hidden w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="ปิดสารบัญ"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <ol class="overflow-y-auto p-2 space-y-0.5" data-toc>
            ${book.chapters.map(c => {
                const cur = c === ch;
                const ready = chReady(c);
                return `<li data-title="${RW.escapeHtml(c.num + ' ' + c.title)}"><a ${bookLink(book.id, c.num)} ${cur ? 'aria-current="page"' : ''}
                    class="flex items-start gap-2.5 px-2.5 py-2 rounded-lg no-underline transition ${cur ? 'bg-purple-100' : 'hover:bg-slate-50'}">
                    <span class="w-6 h-6 shrink-0 rounded-md ${cur ? 'bg-pea-700 text-white' : ready ? 'bg-purple-50 text-pea-800' : 'bg-slate-100 text-slate-400'} flex items-center justify-center text-[11px] font-heading font-bold">${c.num}</span>
                    <span class="min-w-0 flex-1">
                        <span class="block text-[13px] leading-snug font-heading ${cur ? 'font-semibold text-pea-900' : ready ? 'text-slate-700' : 'text-slate-400'}">${RW.escapeHtml(c.title)}</span>
                        <span class="block text-[10px] text-slate-400 mt-0.5">${chMeta(c)}${ready ? '' : ' · กำลังจัดทำ'}</span>
                    </span>
                </a></li>`;
            }).join('')}
        </ol>
    </div>`;
}

function renderClause(c) {
    const isNum = typeof c.num === 'number';
    return `
    <section id="clause-${RW.escapeHtml(String(c.num))}" class="scroll-mt-24 pt-6 first:pt-0">
        <div class="flex items-start gap-3">
            <span class="w-10 h-10 shrink-0 rounded-xl ${isNum ? 'bg-gradient-to-br from-pea-700 to-purple-800' : 'bg-gradient-to-br from-amber-500 to-rose-600'} text-white flex flex-col items-center justify-center font-heading font-bold leading-none">
                ${isNum ? `<span class="text-[9px] font-normal text-purple-200">ข้อ</span><span class="text-sm">${c.num}</span>` : '<i class="fa-solid fa-file-medical text-sm"></i>'}
            </span>
            <div class="min-w-0">
                <h2 class="font-heading font-bold text-base text-slate-900 leading-snug">${RW.escapeHtml(c.title)}</h2>
                <p class="text-xs text-slate-500 mt-0.5">${RW.escapeHtml(c.summary || '')} <span class="ml-1 text-slate-400"><i class="fa-regular fa-file-pdf mr-0.5"></i>${RW.escapeHtml(c.page || '')}</span></p>
            </div>
        </div>
        <div class="mt-3">${c.content}</div>
    </section>`;
}

const clauseItems = (ch) => ch.clauses.map(n => BOOK_DATA.clauses.find(c => String(c.num) === String(n))).filter(Boolean);
// บทที่เป็นหลักเกณฑ์/แนวทาง (id เป็นข้อความ ไม่ใช่เลขข้อ) แสดงเป็นการ์ด แล้วกดเข้าไปอ่านทีละเรื่อง
const isCardChapter = (ch) => ch.clauses && ch.clauses.every(n => typeof n !== 'number');

function renderGuidelineCards(book, ch) {
    return `<div class="grid sm:grid-cols-2 gap-3">${clauseItems(ch).map(c => `
        <a ${bookLink(book.id, ch.num, c.num)} class="group flex flex-col p-4 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 hover:shadow-sm transition no-underline">
            <span class="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center"><i class="fa-solid fa-file-medical text-sm"></i></span>
            <span class="mt-3 font-heading font-bold text-sm text-slate-900 leading-snug group-hover:text-pea-800">${RW.escapeHtml(c.title)}</span>
            <span class="mt-1 text-xs text-slate-500 line-clamp-3">${RW.escapeHtml(c.summary || '')}</span>
            <span class="mt-auto pt-3 flex items-center justify-between text-[11px] font-heading">
                <span class="text-slate-400"><i class="fa-regular fa-file-pdf mr-0.5"></i>${RW.escapeHtml(c.page || '')}</span>
                <span class="text-pea-700 font-semibold">อ่าน <i class="fa-solid fa-arrow-right group-hover:translate-x-0.5 transition"></i></span>
            </span>
        </a>`).join('')}</div>`;
}

function renderGuidelinePager(book, ch, item) {
    const items = clauseItems(ch);
    const i = items.indexOf(item);
    const link = (c, label, align) => c
        ? `<a ${bookLink(book.id, ch.num, c.num)} class="flex-1 min-w-0 p-3 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition no-underline ${align}">
            <span class="block text-[11px] text-slate-500 font-heading">${label}</span>
            <span class="block mt-0.5 text-xs font-heading font-semibold text-pea-800 line-clamp-2">${RW.escapeHtml(c.title)}</span></a>`
        : '<span class="flex-1 hidden sm:block"></span>';
    return `<div class="flex flex-col sm:flex-row gap-3 mt-8 pt-5 border-t border-slate-100">
        ${link(items[i - 1], '<i class="fa-solid fa-arrow-left mr-1"></i>เรื่องก่อนหน้า', '')}
        ${link(items[i + 1], 'เรื่องถัดไป<i class="fa-solid fa-arrow-right ml-1"></i>', 'sm:text-right')}
    </div>`;
}

function renderBody(book, ch) {
    if (isCardChapter(ch)) return renderGuidelineCards(book, ch);
    if (ch.clauses) {
        const items = clauseItems(ch);
        const jump = items.length > 1 ? `<div class="flex flex-wrap gap-1.5 mb-6 pb-4 border-b border-slate-100"><span class="text-xs text-slate-500 mr-1 self-center">ในบทนี้:</span>${items.map(c =>
            `<a href="#clause-${RW.escapeHtml(String(c.num))}" onclick="return bookScrollTo('${RW.escapeHtml(String(c.num))}')" class="px-2 py-1 rounded-md bg-purple-50 hover:bg-purple-100 text-[11px] font-heading font-semibold text-pea-800 no-underline">${typeof c.num === 'number' ? 'ข้อ ' + c.num : RW.escapeHtml(c.title)}</a>`).join('')}</div>` : '';
        return jump + `<div class="divide-y divide-slate-100 [&>section]:pb-6">${items.map(renderClause).join('')}</div>`;
    }
    if (ch.content) return ch.content;
    if (ch.link) {
        return `<div class="p-6 rounded-2xl bg-purple-50 border border-purple-200 text-center">
            <i class="fa-solid fa-book-open text-2xl text-pea-600 mb-2 block"></i>
            <p class="text-sm text-slate-700">${RW.escapeHtml(ch.link.text || '')}</p>
            <a ${bookLink(ch.link.book, 1)} class="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pea-700 hover:bg-pea-800 text-white text-sm font-heading font-semibold no-underline">${RW.escapeHtml(ch.link.label)} <i class="fa-solid fa-arrow-right"></i></a>
        </div>`;
    }
    return `<div class="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-sm text-slate-500">
        <i class="fa-solid fa-pen-ruler text-2xl text-slate-300 mb-2 block"></i>บทนี้กำลังจัดทำเนื้อหา — สอบถามรายละเอียดได้ที่ <button type="button" onclick="RW.toggleChat(true)" class="text-emerald-700 font-semibold underline">AI ผู้ช่วย</button></div>`;
}

function renderFooterNav(book, prev, next) {
    const card = (c, label, align) => c
        ? `<a ${bookLink(book.id, c.num)} class="flex-1 min-w-0 p-4 rounded-xl bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition no-underline ${align}">
            <span class="block text-xs text-slate-500 font-heading">${label}</span>
            <span class="block mt-0.5 text-sm font-heading font-semibold text-pea-800 truncate">บทที่ ${c.num} ${RW.escapeHtml(c.title)}</span></a>`
        : '<span class="flex-1 hidden sm:block"></span>';
    return `<div class="flex flex-col sm:flex-row gap-3 mt-4">
        ${card(prev, '<i class="fa-solid fa-arrow-left mr-1"></i>บทก่อนหน้า', '')}
        ${card(next, 'บทถัดไป<i class="fa-solid fa-arrow-right ml-1"></i>', 'sm:text-right')}
    </div>`;
}

function renderBook(p) {
    const root = document.getElementById('bookRoot');
    const books = BOOK_DATA.books || [];
    const book = books.find(b => b.id === p.book) || books[0];
    if (!book) { root.innerHTML = RW.errorBox('ยังไม่มีหนังสือในระบบ', 'initBookPage'); return; }
    const ch = book.chapters.find(c => c.num === p.ch) || book.chapters[0];
    const idx = book.chapters.indexOf(ch);
    const prev = book.chapters[idx - 1];
    const next = book.chapters[idx + 1];
    const tools = [...(book.tools || []), ...(ch.tools || [])];
    const item = isCardChapter(ch) && p.clause ? clauseItems(ch).find(c => String(c.num) === String(p.clause)) : null;
    const header = item
        ? `<a ${bookLink(book.id, ch.num)} class="inline-flex items-center gap-1.5 text-xs font-heading font-semibold text-pea-600 hover:text-pea-800 no-underline"><i class="fa-solid fa-arrow-left"></i>บทที่ ${ch.num} ${RW.escapeHtml(ch.title)}</a>
           <h1 class="mt-2 text-xl sm:text-2xl font-heading font-bold text-slate-900 leading-snug">${RW.escapeHtml(item.title)}</h1>
           <p class="mt-1 text-xs text-slate-500">${RW.escapeHtml(item.summary || '')} <span class="ml-1 text-slate-400"><i class="fa-regular fa-file-pdf mr-0.5"></i>${RW.escapeHtml(item.page || '')}</span></p>`
        : `<span class="text-xs font-heading font-semibold text-pea-600">บทที่ ${ch.num} · ${chMeta(ch)}</span>
           <h1 class="mt-1 text-xl sm:text-2xl font-heading font-bold text-slate-900 leading-snug">${RW.escapeHtml(ch.title)}</h1>
           ${tools.length || ch.topics ? `<div class="flex flex-wrap gap-2 mt-4">${tools.map(toolButton).join('')}${ch.topics ? mapButton(ch.topics[0]) : ''}</div>` : ''}`;
    const body = item ? item.content + renderGuidelinePager(book, ch, item) : renderBody(book, ch);

    root.innerHTML = `
    ${renderBanner(book, ch, prev, next)}
    ${book.note ? `<p class="mt-2 px-1 text-[11px] text-amber-700"><i class="fa-solid fa-circle-info mr-1"></i>${RW.escapeHtml(book.note)}</p>` : ''}
    <div class="mt-4 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6 items-start">
        <aside id="bookToc" class="hidden lg:block fixed inset-0 z-50 bg-slate-900/50 p-3 lg:p-0 lg:bg-transparent lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]" onclick="if(event.target===this)bookToc(false)">
            <div class="h-full max-w-xs lg:max-w-none">${renderSidebar(book, ch)}</div>
        </aside>
        <article class="min-w-0">
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-8">
                ${header}
                <div class="mt-5 pt-5 border-t border-slate-100 text-sm text-slate-700">${body}</div>
            </div>
            ${renderFooterNav(book, prev, next)}
        </article>
    </div>`;

    document.title = `${item ? item.title : 'บทที่ ' + ch.num + ' ' + ch.title} - ${book.short || book.title}`;
    const cur = root.querySelector('[data-toc] [aria-current]');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
    if (!(p.clause && bookScrollTo(p.clause) === false)) window.scrollTo(0, 0);
}

// เลื่อนไปที่ข้อในบท — คืน false เมื่อเจอ (ใช้เป็นค่าคืนของ onclick ได้)
function bookScrollTo(num) {
    const el = document.getElementById('clause-' + num);
    if (!el) return true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return false;
}
window.bookScrollTo = bookScrollTo;

function bookToc(open) {
    const el = document.getElementById('bookToc');
    if (el) el.classList.toggle('hidden', !open);
}
window.bookToc = bookToc;

function bookFilterToc(input) {
    const q = input.value.trim().toLowerCase();
    input.closest('div.flex-col').querySelectorAll('[data-toc] li').forEach(li => {
        li.classList.toggle('hidden', q && !li.dataset.title.toLowerCase().includes(q));
    });
}
window.bookFilterToc = bookFilterToc;

function initBookPage() {
    const root = document.getElementById('bookRoot');
    root.innerHTML = RW.loadingBox('กำลังเปิดหนังสือ...');
    RW.loadData(d => {
        BOOK_DATA = d;
        renderBook(bookParams());
    }).catch(err => {
        root.innerHTML = RW.errorBox(err.message, 'initBookPage');
    });
}

window.addEventListener('popstate', () => { if (BOOK_DATA) renderBook(bookParams()); });
initBookPage();
