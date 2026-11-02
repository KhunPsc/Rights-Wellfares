// หน้า: เครื่องมือจำลองคำนวณ & วินิจฉัยสิทธิ
// เครื่องคำนวณทำงานในเบราว์เซอร์ทั้งหมด — มีแค่ wizard ที่ใช้ข้อมูลจาก Apps Script (src/data/wizard.json)
let WIZARD_OPTIONS = null;

// ==========================================
// INTERACTIVE CALCULATOR 1: MEDICAL CLAIM
// ==========================================
function calculateMedicalClaim() {
    const patientType = document.getElementById('calcPatientType').value;
    const hospType = document.getElementById('calcHospType').value;
    const days = Math.max(0, parseFloat(document.getElementById('calcDays').value) || 0);
    const roomTotal = Math.max(0, parseFloat(document.getElementById('calcRoomTotal').value) || 0);
    const medTotal = Math.max(0, parseFloat(document.getElementById('calcMedTotal').value) || 0);
    const discountPct = Math.min(100, Math.max(0, parseFloat(document.getElementById('calcDiscountPct').value) || 0));
    const otherAgency = Math.max(0, parseFloat(document.getElementById('calcOtherAgency').value) || 0);
    const carAccident = document.getElementById('calcCarAccident').value;

    const factor = 1 - (discountPct / 100);
    const roomAfterDisc = roomTotal * factor;
    const medAfterDisc = medTotal * factor;

    let roomCapPerDay = 1500;
    let patientRoleLabel = 'ผู้ปฏิบัติงาน (พนักงาน กฟภ.) เพดาน 1,500 บ./วัน';
    if (patientType === 'family') {
        roomCapPerDay = 1100;
        patientRoleLabel = 'บุคคลในครอบครัวของพนักงาน เพดาน 1,100 บ./วัน';
    } else if (patientType === 'worker') {
        roomCapPerDay = 1000;
        patientRoleLabel = 'ลูกจ้าง กฟภ. และครอบครัวของลูกจ้าง เพดาน 1,000 บ./วัน';
    }

    let eligibleRoom = 0;
    let eligibleMed = 0;
    let explanation = [];

    if (patientType === 'duty') {
        eligibleRoom = roomAfterDisc;
        eligibleMed = medAfterDisc;
        explanation.push('กรณีเจ็บป่วยเนื่องจากปฏิบัติหน้าที่ (ข้อ 35): เบิกค่าห้อง ค่าอาหาร และค่ารักษาพยาบาลได้เต็มจำนวน 100%');
    } else if (hospType === 'gov_ipd') {
        const maxRoomAllowed = days * roomCapPerDay;
        eligibleRoom = Math.min(roomAfterDisc, maxRoomAllowed);
        eligibleMed = medAfterDisc;
        explanation.push(`รพ.ราชการ (คนไข้ใน): ค่าห้อง+อาหารเบิกตามจริงแต่ไม่เกิน ${roomCapPerDay.toLocaleString()} บ./วัน (${days} วัน = เพดาน ${maxRoomAllowed.toLocaleString()} บ.) [${patientRoleLabel}] ส่วนค่ารักษาที่เบิกได้ เบิกได้ 100%`);
    } else if (hospType === 'gov_opd') {
        eligibleRoom = 0;
        eligibleMed = medAfterDisc;
        explanation.push('รพ.ราชการ (คนไข้นอก): เบิกค่ารักษาพยาบาลได้เท่าที่จ่ายจริง 100% (ไม่มีค่าห้องผู้ป่วยใน)');
    } else if (hospType === 'priv_ipd') {
        const maxRoomAllowed = days * roomCapPerDay;
        eligibleRoom = Math.min(roomAfterDisc, maxRoomAllowed);
        eligibleMed = medAfterDisc * 0.5;
        explanation.push(`รพ.เอกชน (คนไข้ใน): ค่าห้อง+อาหารเบิกตามจริงแต่ไม่เกิน ${roomCapPerDay.toLocaleString()} บ./วัน (${days} วัน = เพดาน ${maxRoomAllowed.toLocaleString()} บ.) [${patientRoleLabel}] ส่วนค่ารักษาพยาบาลเบิกได้ครึ่งหนึ่ง (50%)`);
    } else if (hospType === 'priv_opd') {
        eligibleRoom = 0;
        eligibleMed = Math.min(medAfterDisc, 3600);
        explanation.push('รพ.เอกชน / คลินิกเอกชน (คนไข้นอก): เบิกได้เท่าที่จ่ายจริง แต่รวมกันไม่เกินปีละ 3,600 บาท (ข้อ 7.5.3 - 7.5.4)');
    }

    let grossPeaEntitlement = eligibleRoom + eligibleMed;
    let netPayable = grossPeaEntitlement - otherAgency;

    if (carAccident === 'deduct30k') {
        netPayable -= 30000;
        explanation.push('หักค่าเสียหายเบื้องต้น พ.ร.บ. คุ้มครองผู้ประสบภัยจากรถ 30,000 บาท (ตามข้อ 25.4 / 25.5)');
    }

    netPayable = Math.max(0, netPayable);

    // Determine Approval Authority (Clause 43)
    let approver = 'ผู้จัดการการไฟฟ้าส่วนภูมิภาคสาขา (ไม่เกิน 50,000 บาท - ข้อ 43.4)';
    if (netPayable > 300000) {
        approver = 'ผู้ช่วยผู้ว่าการ (มีอำนาจตามที่จ่ายจริง - ข้อ 43.1)';
    } else if (netPayable > 100000) {
        approver = 'ผอ.ฝ่าย (เขต) / ผจก.กฟภ. ชั้น 1 (ไม่เกิน 300,000 บาท - ข้อ 43.2)';
    } else if (netPayable > 50000) {
        approver = 'ผอ.กอง (เขต) / ผจก.กฟภ. ชั้น 2-3 (ไม่เกิน 100,000 บาท - ข้อ 43.3)';
    }

    const fmt = RW.fmt;

    document.getElementById('calcResultBox').innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div class="p-3 rounded-xl bg-white border border-purple-200">
                <div class="text-xs text-slate-500">1. สิทธิค่าห้อง+อาหารที่เบิกได้</div>
                <div class="text-base font-heading font-bold text-slate-800">${fmt(eligibleRoom)} บาท</div>
            </div>
            <div class="p-3 rounded-xl bg-white border border-purple-200">
                <div class="text-xs text-slate-500">2. สิทธิค่ารักษาพยาบาลที่เบิกได้</div>
                <div class="text-base font-heading font-bold text-slate-800">${fmt(eligibleMed)} บาท</div>
            </div>
            <div class="p-3 rounded-xl bg-pea-800 text-white shadow">
                <div class="text-xs text-purple-200">สุทธิเบิกจาก กฟภ. ได้</div>
                <div class="text-lg font-heading font-bold text-amber-300">${fmt(netPayable)} บาท</div>
            </div>
        </div>
        <div class="text-xs text-slate-700 space-y-1">
            <div><i class="fa-solid fa-circle-info text-pea-600 mr-1"></i><strong>วิธีคำนวณ:</strong> ${explanation.join(' | ')}</div>
            ${patientType === 'worker' ? `<div class="text-amber-800 font-medium"><i class="fa-solid fa-people-arrows mr-1"></i><strong>หมายเหตุข้อ 8.1:</strong> กรณีลูกจ้างมีคู่สมรสเป็นพนักงาน กฟภ. สามารถนำค่าห้องส่วนเกินสิทธิของลูกจ้าง (เกิน 1,000 บ./วัน) ไปเบิกเพิ่มในสิทธิครอบครัวของพนักงาน (เพดาน 1,100 บ./วัน) ได้อีกไม่เกินวันละ 100 บาท</div>` : ''}
            <div><i class="fa-solid fa-gavel text-pea-600 mr-1"></i><strong>ผู้มีอำนาจอนุมัติจ่ายเงิน (ข้อ 43):</strong> <span class="font-semibold text-pea-800">${approver}</span></div>
        </div>
    `;
}

// ==========================================
// INTERACTIVE CALCULATOR 2: 90-DAY DEADLINE
// ==========================================
function calculate90Days() {
    const val = document.getElementById('receiptDateInput').value;
    if (!val) return;
    const startDate = new Date(val + 'T00:00:00');
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 90);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

    const opts = { year: 'numeric', month: 'long', day: 'numeric' };
    const startThai = startDate.toLocaleDateString('th-TH', opts);
    const endThai = endDate.toLocaleDateString('th-TH', opts);

    let statusBadge = '';
    if (diffDays >= 0) {
        statusBadge = `<span class="text-emerald-700 font-bold">ยังอยู่ในกำหนดเวลา (เหลืออีก ${diffDays} วัน)</span>`;
    } else {
        statusBadge = `<span class="text-rose-600 font-bold">เกินกำหนด 90 วันแล้ว (${Math.abs(diffDays)} วัน) ต้องเสนอคณะกรรมการกองทุนสงเคราะห์ฯ พิจารณาผ่อนผัน</span>`;
    }

    document.getElementById('date90Result').innerHTML = `
        <div>• <strong>วันเริ่มต้นนับสิทธิ:</strong> ${startThai}</div>
        <div>• <strong>วันครบกำหนด 90 วัน:</strong> <span class="font-bold text-pea-800">${endThai}</span></div>
        <div>• <strong>สถานะเทียบกับวันนี้:</strong> ${statusBadge}</div>
    `;
}

// ==========================================
// INTERACTIVE CALCULATOR 3: CHILD AGE 20
// ==========================================
function calculateChildAge() {
    const val = document.getElementById('childBirthInput').value;
    if (!val) return;
    const birth = new Date(val + 'T00:00:00');

    // Turns 20 on the day before 20th anniversary
    const majorityDate = new Date(birth.getFullYear() + 20, birth.getMonth(), birth.getDate() - 1);
    const lastEligibleDate = new Date(birth.getFullYear() + 20, birth.getMonth(), birth.getDate() - 2);

    const opts = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('childAgeResult').innerHTML = `
        <div>• <strong>วันเกิดบุตร:</strong> ${birth.toLocaleDateString('th-TH', opts)}</div>
        <div>• <strong>วันที่บรรลุนิติภาวะ (ครบ 20 ปีบริบูรณ์):</strong> <span class="font-semibold text-amber-800">${majorityDate.toLocaleDateString('th-TH', opts)}</span></div>
        <div>• <strong>วันสุดท้ายที่มีสิทธิเบิกกับ กฟภ. (ข้อ 2.3):</strong> <span class="font-bold text-emerald-800">${lastEligibleDate.toLocaleDateString('th-TH', opts)}</span></div>
        <div class="text-[11px] text-slate-600 mt-1">*หากนอน รพ. คาบเกี่ยววันบรรลุนิติภาวะ ให้ รพ. แยกค่าใช้จ่าย และเบิกเฉพาะถึงวันสุดท้ายที่ยังไม่บรรลุนิติภาวะ (ข้อ 5)</div>
    `;
}

// ==========================================
// INTERACTIVE WIZARD 4: ENTITLEMENT DECISION
// ==========================================
function runEntitlementWizard() {
    const output = document.getElementById('wizDecisionOutput');
    if (!WIZARD_OPTIONS) {
        output.innerHTML = RW.loadingBox('กำลังโหลดแนวทางวินิจฉัย...');
        return;
    }
    const group = document.getElementById('wizScenarioGroup').value;
    const subSelect = document.getElementById('wizSubCase');
    const options = WIZARD_OPTIONS[group] || [];
    subSelect.innerHTML = options.map((opt, idx) => `<option value="${idx}">${opt.label}</option>`).join('');
    renderWizardDecision();
}

function renderWizardDecision() {
    if (!WIZARD_OPTIONS) return;
    const group = document.getElementById('wizScenarioGroup').value;
    const idx = parseInt(document.getElementById('wizSubCase').value, 10) || 0;
    const item = (WIZARD_OPTIONS[group] || [])[idx];
    if (!item) return;
    document.getElementById('wizDecisionOutput').innerHTML = `
        <div class="font-heading font-bold text-blue-900 mb-1"><i class="fa-solid fa-check-double mr-1.5"></i>แนวทางปฏิบัติที่ถูกต้องตามระเบียบ:</div>
        <div class="text-slate-800 leading-relaxed">${item.result}</div>
    `;
}

function initWizard() {
    runEntitlementWizard();
    RW.loadData(d => {
        WIZARD_OPTIONS = d.wizard;
        runEntitlementWizard();
    }).catch(err => {
        document.getElementById('wizDecisionOutput').innerHTML = RW.errorBox(err.message, 'initWizard');
    });
}

// Set today's date for 90-day calculator
document.getElementById('receiptDateInput').value = new Date().toISOString().split('T')[0];
calculateMedicalClaim();
calculate90Days();
calculateChildAge();
initWizard();
