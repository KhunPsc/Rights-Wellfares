// หน้า: อัตราเบี้ยเลี้ยง-ค่าเช่าที่พัก (TAX) — อัตรามาจาก Apps Script (src/data/allowance-rates.json)
let ALLOWANCE_RATES = null;

function calculateAllowanceTax() {
    const box = document.getElementById('alwCalcResult');
    if (!ALLOWANCE_RATES) {
        box.innerHTML = RW.loadingBox('กำลังโหลดอัตราเบี้ยเลี้ยง...');
        return;
    }
    const level = document.getElementById('alwLevel').value;
    const fullDays = Math.max(0, parseFloat(document.getElementById('alwFullDays').value) || 0);
    const twoThirdDays = Math.max(0, parseFloat(document.getElementById('alwTwoThirdDays').value) || 0);
    const oneThirdDays = Math.max(0, parseFloat(document.getElementById('alwOneThirdDays').value) || 0);
    const hotelType = document.getElementById('alwHotelType').value;
    const hotelNights = Math.max(0, parseFloat(document.getElementById('alwHotelNights').value) || 0);

    const r = ALLOWANCE_RATES[level];
    if (!r) return;

    const perDiemNoTax = (fullDays * r.full.noTax) + (twoThirdDays * r.twoThird.noTax) + (oneThirdDays * r.oneThird.noTax);
    const perDiemTax = (fullDays * r.full.tax) + (twoThirdDays * r.twoThird.tax) + (oneThirdDays * r.oneThird.tax);
    const perDiemTotal = perDiemNoTax + perDiemTax;

    let hotelNoTax = 0;
    let hotelTax = 0;
    let hotelDesc = '';

    if (hotelType === 'lump') {
        hotelTax = hotelNights * r.hotelLump.rate;
        hotelDesc = r.hotelLump.note;
    } else {
        hotelNoTax = hotelNights * r.hotelActual.numericCap;
        hotelDesc = r.hotelActual.note;
    }

    const fmt = RW.fmt;

    box.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div class="text-xs font-heading font-semibold text-emerald-800">1. ยอดรวมที่ไม่ระบุ TAX (ไม่ถือเป็นประโยชน์เพิ่ม)</div>
                <div class="text-xl font-heading font-bold text-emerald-700 mt-1">${fmt(perDiemNoTax + hotelNoTax)} บาท</div>
                <div class="text-xs text-slate-600 mt-1">
                    • ค่าเบี้ยเลี้ยง (ไม่ระบุ TAX): <strong>${fmt(perDiemNoTax)} บ.</strong><br>
                    • ค่าที่พัก (ไม่ระบุ TAX): <strong>${level === '13+' && hotelType === 'actual' ? 'เท่าที่จ่ายจริง' : fmt(hotelNoTax) + ' บ. (เพดานสูงสุด)'}</strong>
                </div>
            </div>
            <div class="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                <div class="text-xs font-heading font-semibold text-rose-800">2. ยอดรวมที่ต้องระบุ TAX ในช่องการกำหนด</div>
                <div class="text-xl font-heading font-bold text-rose-700 mt-1">${fmt(perDiemTax + hotelTax)} บาท</div>
                <div class="text-xs text-slate-600 mt-1">
                    • ค่าเบี้ยเลี้ยง (ระบุ TAX): <strong>${fmt(perDiemTax)} บ.</strong><br>
                    • ค่าที่พักเหมาจ่าย (ระบุ TAX): <strong>${fmt(hotelTax)} บ.</strong>
                </div>
            </div>
            <div class="p-3.5 rounded-xl bg-white border border-slate-200">
                <div class="text-xs font-heading font-semibold text-pea-800">สรุปรวมทั้งสิ้น (${r.label})</div>
                <div class="text-xl font-heading font-bold text-pea-900 mt-1">${fmt(perDiemTotal + hotelTax + hotelNoTax)} บาท</div>
                <div class="text-[11px] text-slate-500 mt-1">
                    รวมค่าเบี้ยเลี้ยง: <strong>${fmt(perDiemTotal)} บ.</strong><br>
                    หมายเหตุที่พัก: ${hotelDesc}
                </div>
            </div>
        </div>
    `;
}

function initAllowancePage() {
    calculateAllowanceTax();
    RW.loadData(d => {
        ALLOWANCE_RATES = d.allowanceRates;
        calculateAllowanceTax();
    }).catch(err => {
        document.getElementById('alwCalcResult').innerHTML = RW.errorBox(err.message, 'initAllowancePage');
    });
}

initAllowancePage();
