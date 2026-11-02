// หน้า: ดาวน์โหลดแบบฟอร์มและเอกสาร
function initFormsPage() {
    const container = document.getElementById('formsContainer');
    container.innerHTML = RW.loadingBox('กำลังโหลดรายการแบบฟอร์ม...');

    RW.loadData(d => {
        const forms = d.forms || [];
        if (!forms.length) {
            container.innerHTML = `<div class="p-8 text-center text-slate-500">ไม่พบรายการแบบฟอร์ม</div>`;
            return;
        }

        container.innerHTML = forms.map(f => `
            <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4">
                <div class="space-y-3">
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-2xl ${f.type === 'word' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'} flex items-center justify-center text-2xl shrink-0">
                                <i class="fa-regular ${f.type === 'word' ? 'fa-file-word' : 'fa-file-pdf'}"></i>
                            </div>
                            ${f.category ? `<span class="px-2.5 py-0.5 rounded-md text-[11px] font-heading font-semibold bg-purple-50 text-pea-800 border border-purple-200">${RW.escapeHtml(f.category)}</span>` : ''}
                        </div>
                        <span class="px-2.5 py-1 rounded-full text-[11px] font-heading font-semibold ${f.type === 'word' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}">
                            ไฟล์ ${RW.escapeHtml(f.ext || f.type.toUpperCase())}
                        </span>
                    </div>
                    <div>
                        <h2 class="font-heading font-bold text-base text-slate-900">${RW.escapeHtml(f.title || f.label)}</h2>
                        <p class="text-xs text-slate-500 mt-1 leading-relaxed">${RW.escapeHtml(f.desc || '')}</p>
                    </div>
                </div>

                <div class="pt-2 border-t border-slate-100">
                    <a
                        href="${RW.escapeHtml(f.url)}"
                        target="_blank"
                        rel="noopener"
                        class="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white font-heading font-semibold text-xs sm:text-sm shadow transition ${f.type === 'word' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-rose-600 hover:bg-rose-700'}"
                    >
                        <i class="fa-solid fa-cloud-arrow-down"></i>
                        <span>ดาวน์โหลดไฟล์ ${f.ext || f.type.toUpperCase()} ทันที</span>
                    </a>
                </div>
            </div>
        `).join('');
    }).catch(err => {
        container.innerHTML = RW.errorBox(err.message, 'initFormsPage');
    });
}

initFormsPage();
