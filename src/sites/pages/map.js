// หน้าแผนที่ความรู้: กราฟหัวข้อ wiki (SITE_DATA.graph) ด้วย force-graph
// หัวข้อที่เลือกเก็บใน ?topic= และ localStorage 'rw_map_topic' (Google Sites ตัด query string) — กดย้อนกลับจากหนังสือแล้วกลับมาที่เดิม
const MAP_TYPES = {
    welfare: { label: 'สวัสดิการ', color: '#8e1a78' },
    right: { label: 'สิทธิ', color: '#2563eb' },
    form: { label: 'แบบฟอร์ม / อนุมัติจ่าย', color: '#d97706' },
    agency: { label: 'สถานพยาบาล', color: '#059669' },
    source: { label: 'ระเบียบ / หนังสือต้นฉบับ', color: '#94a3b8' },
};
let MAP = null;          // { nodes, links, byId, neighbors }
let mapGraph = null;
let mapSelected = null;
let mapHovered = null;
const mapEnabled = new Set(Object.keys(MAP_TYPES));

const nodeRadius = (n) => Math.sqrt(n.type === 'source' ? 2 : 4 + n.deg) * 4;
const isNear = (n) => {
    const f = mapHovered || mapSelected;
    return !f || f === n || MAP.neighbors.get(f.id).has(n.id);
};
const touchesFocus = (l) => {
    const f = mapHovered || mapSelected;
    return f && (l.source.id === f.id || l.target.id === f.id);
};

function drawNode(n, ctx, scale) {
    const r = nodeRadius(n);
    const dim = !isNear(n);
    ctx.globalAlpha = dim ? 0.15 : 1;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = MAP_TYPES[n.type].color;
    ctx.fill();
    if (n === mapSelected) { ctx.lineWidth = 3 / scale; ctx.strokeStyle = '#fbbf24'; ctx.stroke(); }
    const related = mapSelected && MAP.neighbors.get(mapSelected.id).has(n.id);
    const showLabel = !dim && (n === mapSelected || n === mapHovered || related || scale > 1.6 || (n.type !== 'source' && (n.deg >= 4 || scale > 1.1)));
    if (showLabel) {
        const fs = Math.max(12 / scale, 2.5);
        const label = n.title.length > 34 ? n.title.slice(0, 33) + '…' : n.title;
        ctx.font = `${n.type === 'source' ? 400 : 600} ${fs}px Sarabun, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const w = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.fillRect(n.x - w / 2 - 2 / scale, n.y + r + 1 / scale, w + 4 / scale, fs * 1.25);
        ctx.fillStyle = n.type === 'source' ? '#475569' : '#1e293b';
        ctx.fillText(label, n.x, n.y + r + 2 / scale);
    }
    ctx.globalAlpha = 1;
}

function mapApplyFilter() {
    const nodes = MAP.nodes.filter((n) => mapEnabled.has(n.type));
    const ids = new Set(nodes.map((n) => n.id));
    const links = MAP.links.filter((l) => ids.has(l.source.id || l.source) && ids.has(l.target.id || l.target));
    mapGraph.graphData({ nodes, links });
    if (mapSelected && !ids.has(mapSelected.id)) mapSelect(null);
}

function rememberTopic(id) {
    try { localStorage.setItem('rw_map_topic', id || ''); } catch (e) {}
    try {
        const url = new URL(window.location.href);
        if (id) url.searchParams.set('topic', id); else url.searchParams.delete('topic');
        history.replaceState(null, '', url);
    } catch (e) { /* sandbox iframe */ }
}

function mapSelect(n, center) {
    mapSelected = n || null;
    rememberTopic(mapSelected && mapSelected.id);
    renderMapPanel();
    if (n && center && Number.isFinite(n.x)) {
        mapGraph.centerAt(n.x, n.y, 600);
        mapGraph.zoom(Math.max(mapGraph.zoom(), 2), 600);
    }
}
window.mapSelectId = (id) => {
    const n = MAP.byId.get(id);
    if (!n) return;
    if (!mapEnabled.has(n.type)) toggleType(n.type, true);
    mapSelect(n, true);
};

function chapterLink(c) {
    const base = RW.pageUrl('book') || 'book.html';
    return `<a href="${base}?book=${encodeURIComponent(c.book)}&ch=${c.ch}" onclick="try{localStorage.setItem('rw_book','${c.book}|${c.ch}')}catch(e){}"
        class="flex items-center gap-2.5 px-3 py-2.5 mb-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-300 transition no-underline">
        <span class="shrink-0 px-1.5 py-0.5 rounded-md bg-pea-700 text-white text-[11px] font-heading font-semibold">${RW.escapeHtml(c.short)} บท ${c.ch}</span>
        <span class="min-w-0 flex-1 text-sm text-pea-900 leading-snug">${RW.escapeHtml(c.title)}</span>
        <i class="fa-solid fa-arrow-right text-xs text-pea-600"></i></a>`;
}

function renderMapPanel() {
    const panel = document.getElementById('mapPanel');
    if (!mapSelected) {
        const topics = MAP.nodes.filter((n) => n.type !== 'source').length;
        panel.innerHTML = `
            <h2 class="font-heading font-bold text-base text-slate-800">สำรวจความเชื่อมโยง</h2>
            <p class="mt-1 text-sm text-slate-600 leading-relaxed">กดจุดบนแผนที่ หรือพิมพ์ชื่อหัวข้อในช่องค้นหา เพื่อดูสรุป บทในหนังสือที่เกี่ยวข้อง และหัวข้อที่เชื่อมกัน</p>
            <div class="grid grid-cols-3 gap-2 mt-4 text-center">
                <div class="rounded-xl bg-purple-50 p-2.5"><div class="font-heading font-bold text-lg text-pea-800">${topics}</div><div class="text-[11px] text-slate-500">หัวข้อ</div></div>
                <div class="rounded-xl bg-purple-50 p-2.5"><div class="font-heading font-bold text-lg text-pea-800">${MAP.nodes.length - topics}</div><div class="text-[11px] text-slate-500">ระเบียบต้นฉบับ</div></div>
                <div class="rounded-xl bg-purple-50 p-2.5"><div class="font-heading font-bold text-lg text-pea-800">${MAP.links.length}</div><div class="text-[11px] text-slate-500">ความเชื่อมโยง</div></div>
            </div>
            <h3 class="mt-5 mb-2 text-xs font-heading font-semibold text-slate-500">หัวข้อที่เชื่อมโยงมากที่สุด</h3>
            <div>${MAP.nodes.filter((n) => n.type !== 'source').sort((a, b) => b.deg - a.deg).slice(0, 6).map(relChip).join('')}</div>`;
        return;
    }
    const n = mapSelected;
    const t = MAP_TYPES[n.type];
    const rel = [...MAP.neighbors.get(n.id)].map((id) => MAP.byId.get(id))
        .sort((a, b) => (a.type === 'source') - (b.type === 'source') || b.deg - a.deg);
    panel.innerHTML = `
        <div class="flex items-start justify-between gap-2">
            <span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-heading font-semibold text-white" style="background:${t.color}">${t.label}</span>
            <button type="button" onclick="mapSelect(null)" class="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="ปิดรายละเอียด"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <h2 class="mt-2 font-heading font-bold text-lg text-slate-900 leading-snug">${RW.escapeHtml(n.title)}</h2>
        ${n.summary ? `<p class="mt-1 text-sm font-semibold text-pea-800 leading-relaxed">${RW.escapeHtml(n.summary)}</p>` : ''}
        ${n.points.length ? `<ul class="mt-2 list-disc pl-5 space-y-1 text-sm text-slate-600 leading-relaxed">${n.points.map((p) => `<li>${RW.escapeHtml(p)}</li>`).join('')}</ul>` : ''}
        ${n.chapters.length ? `<h3 class="mt-5 mb-2 text-xs font-heading font-semibold text-slate-500"><i class="fa-solid fa-book-open mr-1"></i>อ่านในหนังสือ</h3>${n.chapters.map(chapterLink).join('')}` : ''}
        <button type="button" onclick="RW.askQuestion(${RW.escapeHtml(JSON.stringify('สรุปเรื่อง ' + n.title + ' ให้หน่อย'))})"
            class="mt-1.5 w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-left transition">
            <span class="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-heading font-semibold">AI</span>
            <span class="text-sm text-emerald-900">ถาม AI เรื่องนี้</span></button>
        ${n.headings.length ? `<h3 class="mt-5 mb-2 text-xs font-heading font-semibold text-slate-500">ในหัวข้อนี้มี</h3><div>${n.headings.map((h) => `<span class="inline-block mr-1.5 mb-1.5 px-2 py-1 rounded-lg bg-slate-100 text-xs text-slate-600">${RW.escapeHtml(h)}</span>`).join('')}</div>` : ''}
        ${rel.length ? `<h3 class="mt-5 mb-2 text-xs font-heading font-semibold text-slate-500">หัวข้อที่เชื่อมโยง (${rel.length})</h3><div>${rel.map(relChip).join('')}</div>` : ''}`;
}

function relChip(r) {
    return `<button type="button" onclick="mapSelectId(${RW.escapeHtml(JSON.stringify(r.id))})"
        class="inline-block mr-1.5 mb-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-purple-50 text-xs text-slate-700 text-left" style="border-left:3px solid ${MAP_TYPES[r.type].color}">${RW.escapeHtml(r.title)}</button>`;
}

function toggleType(type, on) {
    const enable = on === undefined ? !mapEnabled.has(type) : on;
    if (enable) mapEnabled.add(type); else mapEnabled.delete(type);
    const chip = document.querySelector(`#mapLegend [data-type="${type}"]`);
    if (chip) { chip.classList.toggle('opacity-40', !enable); chip.setAttribute('aria-pressed', String(enable)); }
    mapApplyFilter();
}
window.toggleType = toggleType;
window.mapSelect = mapSelect;
window.mapZoom = (k) => mapGraph && mapGraph.zoom(mapGraph.zoom() * k, 300);
window.mapFit = () => mapGraph && mapGraph.zoomToFit(500, 40);

function initMapPage() {
    const panel = document.getElementById('mapPanel');
    if (typeof ForceGraph !== 'function') {
        panel.innerHTML = RW.errorBox('โหลดตัววาดแผนที่ไม่สำเร็จ ลองรีเฟรชหน้า', 'initMapPage');
        return;
    }
    panel.innerHTML = RW.loadingBox('กำลังโหลดแผนที่...');
    RW.loadData((d) => {
        if (!d.graph) { panel.innerHTML = RW.errorBox('ยังไม่มีข้อมูลแผนที่ในระบบ', 'initMapPage'); return; }
        // ข้อมูลอาจถูกเรียกซ้ำ (cache แล้ว revalidate) — สร้างกราฟครั้งเดียว
        if (mapGraph) return;
        const nodes = d.graph.nodes.map((n) => ({ ...n }));
        const byId = new Map(nodes.map((n) => [n.id, n]));
        const neighbors = new Map(nodes.map((n) => [n.id, new Set()]));
        d.graph.links.forEach((l) => { neighbors.get(l.source).add(l.target); neighbors.get(l.target).add(l.source); });
        nodes.forEach((n) => { n.deg = neighbors.get(n.id).size; });
        MAP = { nodes, links: d.graph.links.map((l) => ({ ...l })), byId, neighbors };

        document.getElementById('mapLegend').innerHTML = Object.entries(MAP_TYPES).map(([k, t]) =>
            `<button type="button" data-type="${k}" aria-pressed="true" onclick="toggleType('${k}')"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50 transition">
                <span class="w-2.5 h-2.5 rounded-full" style="background:${t.color}"></span>${t.label} (${nodes.filter((n) => n.type === k).length})</button>`).join('');
        document.getElementById('mapTitles').innerHTML = nodes.map((n) => `<option value="${RW.escapeHtml(n.title)}">`).join('');
        document.getElementById('mapSearch').addEventListener('change', (e) => {
            const q = e.target.value.trim();
            const n = nodes.find((x) => x.title === q) || nodes.find((x) => x.title.includes(q));
            if (n) window.mapSelectId(n.id);
        });

        const el = document.getElementById('mapGraph');
        mapGraph = ForceGraph()(el)
            .backgroundColor('rgba(0,0,0,0)')
            .nodeId('id')
            .nodeLabel(() => '')
            .nodeVal((n) => (n.type === 'source' ? 2 : 4 + n.deg))
            .nodeCanvasObject(drawNode)
            .nodePointerAreaPaint((n, color, ctx) => {
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(n.x, n.y, nodeRadius(n) + 3, 0, 2 * Math.PI); ctx.fill();
            })
            .linkColor((l) => (!(mapHovered || mapSelected) ? 'rgba(148,163,184,.35)' : touchesFocus(l) ? 'rgba(142,26,120,.75)' : 'rgba(148,163,184,.12)'))
            .linkWidth((l) => (touchesFocus(l) ? 2 : 1))
            .onNodeHover((n) => { mapHovered = n || null; el.style.cursor = n ? 'pointer' : ''; })
            .onNodeClick((n) => mapSelect(n, true))
            .onBackgroundClick(() => mapSelect(null))
            .graphData({ nodes: MAP.nodes, links: MAP.links });
        mapGraph.d3Force('charge').strength(-140);
        mapGraph.d3Force('link').distance((l) => (l.source.type === 'source' || l.target.type === 'source' ? 70 : 50));

        document.getElementById('mapGraphLoading')?.remove();
        const resize = () => mapGraph.width(el.clientWidth).height(el.clientHeight);
        resize();
        if (window.ResizeObserver) new ResizeObserver(resize).observe(el); else window.addEventListener('resize', resize);

        // หัวข้อจากลิงก์ (?topic=) หรือที่เลือกค้างไว้ — รอให้จุดจัดตำแหน่งก่อนค่อยซูมไป
        let start = new URLSearchParams(window.location.search).get('topic');
        if (!start) { try { start = localStorage.getItem('rw_map_topic'); } catch (e) {} }
        renderMapPanel();
        setTimeout(() => {
            if (start && byId.has(start)) window.mapSelectId(start);
            else mapGraph.zoomToFit(600, 40);
        }, 1200);
    }).catch((err) => {
        panel.innerHTML = RW.errorBox(err.message, 'initMapPage');
        document.getElementById('mapGraphLoading')?.remove();
    });
}

initMapPage();
