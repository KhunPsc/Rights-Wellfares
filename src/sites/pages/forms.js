// หน้า: ดาวน์โหลดแบบฟอร์มและเอกสาร — สลับมุมมอง tiles / content / list (จำค่าใน localStorage)
let formsData = [];

function fileStyle(f) {
    const word = f.type === 'word';
    return {
        icon: word ? 'fa-file-word' : 'fa-file-pdf',
        tint: word ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600',
        btn: word ? 'bg-blue-600 hover:bg-blue-700' : 'bg-rose-600 hover:bg-rose-700',
        ext: RW.escapeHtml(f.ext || f.type.toUpperCase()),
    };
}

const categoryChip = f => f.category
    ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-heading font-semibold bg-purple-50 text-pea-800 border border-purple-200 whitespace-nowrap">${RW.escapeHtml(f.category)}</span>`
    : '';

// ทั้งการ์ด/แถวเป็นลิงก์ดาวน์โหลด
const linkAttrs = f => `href="${RW.escapeHtml(f.url)}" target="_blank" rel="noopener" title="ดาวน์โหลด ${RW.escapeHtml(f.title || f.label)}"`;

const FORM_VIEWS = {
    tiles: {
        box: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3',
        item: (f, s) => `
            <a ${linkAttrs(f)} class="group bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm hover:shadow-md hover:border-purple-300 transition flex flex-col gap-2 no-underline">
                <div class="flex items-start justify-between gap-2">
                    <span class="w-9 h-9 rounded-lg ${s.tint} flex items-center justify-center text-lg shrink-0"><i class="fa-regular ${s.icon}"></i></span>
                    <span class="text-[10px] font-heading font-semibold text-slate-400">${s.ext}</span>
                </div>
                <h2 class="font-heading font-semibold text-xs sm:text-sm text-slate-800 leading-snug line-clamp-3">${RW.escapeHtml(f.title || f.label)}</h2>
                <div class="mt-auto pt-1 flex items-center justify-between gap-2">
                    <span class="min-w-0 truncate">${categoryChip(f)}</span>
                    <i class="fa-solid fa-cloud-arrow-down text-slate-400 group-hover:text-pea-700"></i>
                </div>
            </a>`,
    },
    content: {
        box: 'bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden',
        item: (f, s) => `
            <a ${linkAttrs(f)} class="group flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 hover:bg-purple-50/50 transition no-underline">
                <span class="w-10 h-10 rounded-xl ${s.tint} flex items-center justify-center text-xl shrink-0"><i class="fa-regular ${s.icon}"></i></span>
                <span class="min-w-0 flex-1">
                    <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span class="font-heading font-semibold text-sm text-slate-800 leading-snug">${RW.escapeHtml(f.title || f.label)}</span>
                        ${categoryChip(f)}
                    </span>
                    <span class="block text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">${RW.escapeHtml(f.desc || '')}</span>
                </span>
                <span class="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-white font-heading font-semibold text-xs ${s.btn}">
                    <i class="fa-solid fa-cloud-arrow-down"></i><span class="hidden sm:inline">${s.ext}</span>
                </span>
            </a>`,
    },
    list: {
        box: 'bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden',
        item: (f, s) => `
            <a ${linkAttrs(f)} class="group flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-purple-50/50 transition no-underline">
                <i class="fa-regular ${s.icon} ${s.tint.split(' ')[1]} shrink-0"></i>
                <span class="min-w-0 flex-1 md:truncate text-sm leading-snug text-slate-800">${RW.escapeHtml(f.title || f.label)}</span>
                <span class="hidden md:inline text-[11px] text-slate-500 whitespace-nowrap">${RW.escapeHtml(f.category || '')}</span>
                <span class="text-[10px] font-heading font-semibold text-slate-400 w-9 text-right">${s.ext}</span>
                <i class="fa-solid fa-cloud-arrow-down text-slate-400 group-hover:text-pea-700 shrink-0"></i>
            </a>`,
    },
};

function getFormsView() {
    try { const v = localStorage.getItem('rw_forms_view'); if (FORM_VIEWS[v]) return v; } catch (e) { }
    return 'content';
}

function setFormsView(view) {
    if (!FORM_VIEWS[view]) return;
    try { localStorage.setItem('rw_forms_view', view); } catch (e) { }
    renderForms(view);
}

function renderForms(view) {
    const container = document.getElementById('formsContainer');
    const v = FORM_VIEWS[view];
    container.className = v.box;
    container.innerHTML = formsData.map(f => v.item(f, fileStyle(f))).join('');
    document.querySelectorAll('[data-forms-view]').forEach(b => {
        const on = b.dataset.formsView === view;
        b.setAttribute('aria-pressed', on);
        b.classList.toggle('bg-white', on);
        b.classList.toggle('text-pea-800', on);
        b.classList.toggle('shadow-sm', on);
        b.classList.toggle('text-slate-500', !on);
    });
}

function initFormsPage() {
    const container = document.getElementById('formsContainer');
    container.innerHTML = RW.loadingBox('กำลังโหลดรายการแบบฟอร์ม...');

    RW.loadData(d => {
        formsData = d.forms || [];
        const count = document.getElementById('formsCount');
        if (count) count.textContent = formsData.length;
        if (!formsData.length) {
            container.innerHTML = `<div class="p-8 text-center text-slate-500">ไม่พบรายการแบบฟอร์ม</div>`;
            return;
        }
        renderForms(getFormsView());
    }).catch(err => {
        container.innerHTML = RW.errorBox(err.message, 'initFormsPage');
    });
}

window.setFormsView = setFormsView;
initFormsPage();
