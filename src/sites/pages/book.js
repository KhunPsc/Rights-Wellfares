// หน้าหนังสือ: ?book=<id> = ปก + สารบัญ · ?book=<id>&ch=<n> = อ่านบท
// Google Sites ไม่ส่ง query string เข้า embed — ลิงก์จึงเก็บสำรองไว้ใน localStorage 'rw_book' = "<id>|<ch>"
function bookParams() {
    const q = new URLSearchParams(window.location.search);
    if (q.get('book')) return { book: q.get('book'), ch: parseInt(q.get('ch'), 10) || 0 };
    try {
        const [book, ch] = (localStorage.getItem('rw_book') || '').split('|');
        if (book) return { book, ch: parseInt(ch, 10) || 0 };
    } catch (e) { /* storage ถูกบล็อก */ }
    return { book: '', ch: 0 };
}

function bookLink(bookId, ch) {
    const base = RW.pageUrl('book') || 'book.html';
    const key = `${bookId}|${ch || 0}`;
    return `href="${base}?book=${encodeURIComponent(bookId)}${ch ? '&ch=' + ch : ''}" onclick="try{localStorage.setItem('rw_book','${key}')}catch(e){}"`;
}

function toolButton(t) {
    return `<a href="${RW.pageUrl(t.page) || t.page + '.html'}" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50 text-xs font-heading font-semibold text-pea-800 transition no-underline">
        <i class="fa-solid ${t.icon || 'fa-arrow-up-right-from-square'}"></i><span>${RW.escapeHtml(t.label)}</span></a>`;
}

function renderToc(book) {
    const done = book.chapters.filter(c => c.content || c.link).length;
    return `
    <div class="grid lg:grid-cols-3 gap-6">
        <div class="lg:col-span-1">
            <div class="bg-gradient-to-br from-pea-900 via-pea-700 to-purple-800 rounded-3xl p-6 text-white shadow-xl border-b-4 border-pea-gold lg:sticky lg:top-20">
                <div class="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl text-amber-300 mb-4"><i class="fa-solid ${book.icon || 'fa-book'}"></i></div>
                <span class="px-2.5 py-0.5 text-xs font-heading font-semibold bg-amber-400 text-slate-900 rounded-full">${RW.escapeHtml(book.short || '')}</span>
                <h1 class="mt-3 text-xl font-heading font-bold leading-snug">${RW.escapeHtml(book.title)}</h1>
                <p class="mt-1 text-xs text-purple-200">${RW.escapeHtml(book.subtitle || '')}</p>
                <p class="mt-3 text-xs text-purple-200"><i class="fa-regular fa-calendar mr-1"></i>${RW.escapeHtml(book.edition || '')}</p>
                <div class="mt-4 pt-4 border-t border-white/15 text-xs text-purple-100">${book.chapters.length} บท · พร้อมอ่าน ${done} บท</div>
            </div>
            ${book.note ? `<div class="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed"><i class="fa-solid fa-circle-info mr-1"></i>${RW.escapeHtml(book.note)}</div>` : ''}
        </div>
        <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div class="px-5 py-4 border-b border-slate-100">
                <h2 class="font-heading font-bold text-base text-slate-800"><i class="fa-solid fa-list-ol text-pea-600 mr-1.5"></i>สารบัญ</h2>
            </div>
            <ol class="divide-y divide-slate-100">
                ${book.chapters.map(c => {
                    const ready = c.content || c.link;
                    return `<li><a ${bookLink(book.id, c.num)} class="flex items-start gap-3 px-5 py-3 hover:bg-purple-50/60 transition no-underline group">
                        <span class="w-8 h-8 shrink-0 rounded-lg ${ready ? 'bg-purple-100 text-pea-800' : 'bg-slate-100 text-slate-400'} flex items-center justify-center text-xs font-heading font-bold">${c.num}</span>
                        <span class="flex-1 min-w-0">
                            <span class="block text-sm font-heading font-medium ${ready ? 'text-slate-800 group-hover:text-pea-800' : 'text-slate-500'}">${RW.escapeHtml(c.title)}</span>
                            <span class="block text-[11px] text-slate-400 mt-0.5">หน้า ${RW.escapeHtml(c.pages || '-')}${ready ? '' : ' · <span class="text-amber-600">กำลังจัดทำ</span>'}</span>
                        </span>
                        <i class="fa-solid fa-chevron-right text-[10px] text-slate-300 group-hover:text-pea-600 mt-2"></i>
                    </a></li>`;
                }).join('')}
            </ol>
        </div>
    </div>`;
}

function renderChapter(book, ch) {
    const idx = book.chapters.indexOf(ch);
    const prev = book.chapters[idx - 1];
    const next = book.chapters[idx + 1];
    const nav = `
        <div class="flex items-center justify-between gap-3 mt-6">
            ${prev ? `<a ${bookLink(book.id, prev.num)} class="flex-1 min-w-0 p-3 rounded-xl bg-white border border-slate-200 hover:border-purple-300 transition no-underline"><span class="block text-[11px] text-slate-400"><i class="fa-solid fa-arrow-left mr-1"></i>บทที่ ${prev.num}</span><span class="block text-xs font-heading font-semibold text-slate-700 truncate">${RW.escapeHtml(prev.title)}</span></a>` : '<span class="flex-1"></span>'}
            <a ${bookLink(book.id, 0)} class="shrink-0 px-3 py-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-pea-800 text-xs font-heading font-semibold no-underline" title="สารบัญ"><i class="fa-solid fa-list-ol"></i></a>
            ${next ? `<a ${bookLink(book.id, next.num)} class="flex-1 min-w-0 p-3 rounded-xl bg-white border border-slate-200 hover:border-purple-300 transition text-right no-underline"><span class="block text-[11px] text-slate-400">บทที่ ${next.num}<i class="fa-solid fa-arrow-right ml-1"></i></span><span class="block text-xs font-heading font-semibold text-slate-700 truncate">${RW.escapeHtml(next.title)}</span></a>` : '<span class="flex-1"></span>'}
        </div>`;

    let body;
    if (ch.content) {
        body = `<div class="text-sm text-slate-700">${ch.content}</div>`;
    } else if (ch.link) {
        body = `<p class="text-sm text-slate-600">เนื้อหาบทนี้จัดทำเป็นคู่มือแยกพร้อมระบบค้นหา</p>`;
    } else {
        body = `<div class="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-sm text-slate-500">
            <i class="fa-solid fa-pen-ruler text-2xl text-slate-300 mb-2 block"></i>บทนี้กำลังจัดทำเนื้อหา — สอบถามรายละเอียดได้ที่ <button type="button" onclick="RW.toggleChat(true)" class="text-emerald-700 font-semibold underline">AI ผู้ช่วย</button></div>`;
    }

    const actions = [ch.link && { ...ch.link, icon: 'fa-book-open' }, ...(ch.tools || [])].filter(Boolean);
    return `
    <article class="max-w-3xl mx-auto">
        <nav class="text-xs text-slate-500 mb-3"><a ${bookLink(book.id, 0)} class="hover:text-pea-700 no-underline">${RW.escapeHtml(book.short || book.title)}</a> <i class="fa-solid fa-chevron-right text-[9px] mx-1"></i> บทที่ ${ch.num}</nav>
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7">
            <span class="text-xs font-heading font-semibold text-pea-600">บทที่ ${ch.num} · หน้า ${RW.escapeHtml(ch.pages || '-')}</span>
            <h1 class="mt-1 text-lg sm:text-xl font-heading font-bold text-slate-900 leading-snug">${RW.escapeHtml(ch.title)}</h1>
            ${actions.length ? `<div class="flex flex-wrap gap-2 mt-4">${actions.map(toolButton).join('')}</div>` : ''}
            <div class="mt-4 pt-4 border-t border-slate-100">${body}</div>
        </div>
        ${nav}
    </article>`;
}

function initBookPage() {
    const root = document.getElementById('bookRoot');
    root.innerHTML = RW.loadingBox('กำลังเปิดหนังสือ...');
    RW.loadData(d => {
        const books = d.books || [];
        const p = bookParams();
        const book = books.find(b => b.id === p.book) || books[0];
        if (!book) { root.innerHTML = RW.errorBox('ยังไม่มีหนังสือในระบบ', 'initBookPage'); return; }
        const ch = p.ch && book.chapters.find(c => c.num === p.ch);
        root.innerHTML = ch ? renderChapter(book, ch) : renderToc(book);
        document.title = ch ? `บทที่ ${ch.num} ${ch.title} - ${book.short}` : `${book.title} (${book.short})`;
        window.scrollTo(0, 0);
    }).catch(err => {
        root.innerHTML = RW.errorBox(err.message, 'initBookPage');
    });
}

initBookPage();
