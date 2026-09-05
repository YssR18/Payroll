const TYPE_LABELS = {
  salary:'راتب', addition:'إضافة', deduction:'اقتطاع',
  payment:'دفعة', advance:'سلفة', advance_repayment:'سداد سلفة'
};

const params = new URLSearchParams(location.search);
const workerId = params.get('id');

if(workerId){
  document.getElementById('listView').style.display = 'none';
  document.getElementById('detailView').style.display = 'block';
  loadWorkerDetail(workerId);
} else {
  loadWorkersList();
}

// ---------------- قائمة العمال ----------------
async function loadWorkersList(){
  try{
    const [workers, balances] = await Promise.all([Data.listWorkers(), Data.listBalances()]);
    const balMap = Object.fromEntries(balances.map(b => [b.worker_id, b]));
    const tbody = document.getElementById('workersTable');
    document.getElementById('workersEmpty').style.display = workers.length ? 'none' : 'block';

    tbody.innerHTML = workers.map(w => {
      const b = balMap[w.id] || { accrued_salary:0, total_paid:0, advance_balance:0 };
      const due = Number(b.accrued_salary) - Number(b.total_paid);
      return `<tr>
        <td>${w.employee_code}</td>
        <td><a class="worker-link" href="workers.html?id=${w.id}">${w.full_name}</a></td>
        <td>${w.position || '—'}</td>
        <td class="num">${fmtMoney(w.base_salary)}</td>
        <td class="num">${fmtMoney(due)}</td>
        <td class="num">${fmtMoney(b.advance_balance)}</td>
        <td>${w.status === 'active' ? '<span class="pill ok">نشط</span>' : '<span class="pill warn">معطّل</span>'}</td>
      </tr>`;
    }).join('');
  } catch(err){
    document.getElementById('listAlert').innerHTML = `<div class="alert">تعذّر تحميل قائمة العمال. (${err.message || err})</div>`;
  }
}

// ---------------- نافذة إضافة/تعديل عامل ----------------
const workerModal = document.getElementById('workerModal');
document.getElementById('btnAddWorker')?.addEventListener('click', () => openWorkerModal());
document.getElementById('btnCancelWorker').addEventListener('click', () => workerModal.classList.remove('open'));
document.getElementById('btnEditWorker')?.addEventListener('click', async () => {
  const w = await Data.getWorker(workerId);
  openWorkerModal(w);
});

// ---------------- حذف عامل نهائيًا ----------------
const deleteModal = document.getElementById('deleteModal');
document.getElementById('btnDeleteWorker')?.addEventListener('click', async () => {
  const w = await Data.getWorker(workerId);
  document.getElementById('deleteModalText').textContent =
    `أنت على وشك حذف العامل "${w.full_name}" (${w.employee_code}) وكل سجلاته المالية بشكل نهائي.`;
  document.getElementById('deleteConfirmInput').value = '';
  deleteModal.classList.add('open');
});
document.getElementById('btnCancelDelete')?.addEventListener('click', () => deleteModal.classList.remove('open'));
document.getElementById('btnConfirmDelete')?.addEventListener('click', async () => {
  const typed = document.getElementById('deleteConfirmInput').value.trim();
  if(typed !== 'حذف'){
    alert('اكتب كلمة "حذف" بالضبط في الخانة للتأكيد. لم يتم الحذف.');
    return;
  }
  try{
    await Data.deleteWorker(workerId);
    alert('تم حذف العامل وكل سجلاته المالية بنجاح.');
    location.href = 'workers.html';
  } catch(err){
    alert('تعذّر حذف العامل: ' + (err.message || err));
  }
});

// يولّد رقم العامل التالي تلقائيًا بالاعتماد على أعلى رقم موجود بصيغة EMP-0001
async function nextEmployeeCode(){
  const workers = await Data.listWorkers();
  let max = 0;
  workers.forEach(w => {
    const m = /(\d+)/.exec(w.employee_code || '');
    if(m){ const n = parseInt(m[1], 10); if(n > max) max = n; }
  });
  return 'EMP-' + String(max + 1).padStart(4, '0');
}

async function openWorkerModal(w){
  document.getElementById('workerModalTitle').textContent = w ? 'تعديل بيانات عامل' : 'إضافة عامل جديد';
  document.getElementById('wId').value = w?.id || '';
  document.getElementById('fCode').value = w ? w.employee_code : await nextEmployeeCode();
  document.getElementById('fName').value = w?.full_name || '';
  document.getElementById('fPosition').value = w?.position || '';
  document.getElementById('fHireDate').value = w?.hire_date || '';
  document.getElementById('fSalary').value = w?.base_salary ?? '';
  document.getElementById('fAdvLimit').value = w?.advance_limit ?? '';
  document.getElementById('fStatus').value = w?.status || 'active';
  workerModal.classList.add('open');
}

document.getElementById('btnSaveWorker').addEventListener('click', async () => {
  const id = document.getElementById('wId').value;
  const payload = {
    employee_code: document.getElementById('fCode').value.trim(),
    full_name: document.getElementById('fName').value.trim(),
    position: document.getElementById('fPosition').value.trim(),
    hire_date: document.getElementById('fHireDate').value || null,
    base_salary: Number(document.getElementById('fSalary').value || 0),
    advance_limit: Number(document.getElementById('fAdvLimit').value || 0),
    status: document.getElementById('fStatus').value,
  };
  if(!payload.employee_code || !payload.full_name){
    alert('رقم العامل والاسم الكامل حقلان إلزاميان');
    return;
  }
  try{
    if(id){
      await Data.updateWorker(id, payload);
    } else {
      await Data.createWorker(payload);
    }
    workerModal.classList.remove('open');
    if(workerId) location.reload(); else loadWorkersList();
  } catch(err){
    alert('تعذّر الحفظ: ' + (err.message || err));
  }
});

// ---------------- تفاصيل عامل + السجل المالي ----------------
// يضبط حقل التاريخ الافتراضي على اليوم عند تحميل الصفحة
const txDateInput = document.getElementById('txDate');
if(txDateInput) txDateInput.value = todayISO();

// تصنيفات جاهزة للاقتطاعات والإضافات — تظهر فقط عند اختيار النوع المناسب
const CATEGORY_OPTIONS = {
  deduction: ['غياب', 'تأخر', 'خصم إداري', 'خصم آخر'],
  addition: ['منحة', 'ساعات إضافية', 'مكافأة', 'إضافة أخرى'],
};

// يملأ قائمتي الشهر والسنة لتسجيل راتب يدوي، مرة واحدة عند تحميل الصفحة
(function populateSalaryPeriodSelects(){
  const monthSel = document.getElementById('txSalaryMonth');
  const yearSel = document.getElementById('txSalaryYear');
  if(!monthSel || !yearSel) return;
  const now = new Date();
  MONTH_NAMES.forEach((m, i) => {
    monthSel.innerHTML += `<option value="${i+1}" ${i+1 === now.getMonth()+1 ? 'selected':''}>${m}</option>`;
  });
  for(let y = now.getFullYear() - 2; y <= now.getFullYear(); y++){
    yearSel.innerHTML += `<option value="${y}" ${y === now.getFullYear() ? 'selected':''}>${y}</option>`;
  }
})();

function updateCategoryField(){
  const type = document.getElementById('txType').value;
  const wrap = document.getElementById('txCategoryWrap');
  const sel = document.getElementById('txCategory');
  const salaryMonthWrap = document.getElementById('txSalaryPeriodWrap');
  const salaryYearWrap = document.getElementById('txSalaryYearWrap');
  if(salaryMonthWrap) salaryMonthWrap.style.display = type === 'salary' ? '' : 'none';
  if(salaryYearWrap) salaryYearWrap.style.display = type === 'salary' ? '' : 'none';
  if(!wrap || !sel) return;
  const options = CATEGORY_OPTIONS[type];
  if(options){
    wrap.style.display = '';
    sel.innerHTML = options.map(c => `<option value="${c}">${c}</option>`).join('');
  } else {
    wrap.style.display = 'none';
    sel.innerHTML = '';
  }
}
document.getElementById('txType')?.addEventListener('change', updateCategoryField);
updateCategoryField();

async function loadWorkerDetail(id){
  try{
    const [w, b] = await Promise.all([Data.getWorker(id), Data.getBalance(id)]);
    document.getElementById('wFullName').textContent = w.full_name;
    document.getElementById('wCode').textContent = w.employee_code;
    document.getElementById('wPosition').textContent = w.position || '—';
    document.getElementById('wHireDate').textContent = fmtDate(w.hire_date);

    const due = Number(b.accrued_salary) - Number(b.total_paid);
    document.getElementById('wBaseSalary').textContent = fmtMoney(w.base_salary);
    document.getElementById('wAccrued').textContent = fmtMoney(b.accrued_salary);
    document.getElementById('wPaid').textContent = fmtMoney(b.total_paid);
    document.getElementById('wDue').textContent = fmtMoney(due);
    document.getElementById('wAdvance').textContent = fmtMoney(b.advance_balance);
    document.getElementById('wAdvLimit').textContent = fmtMoney(w.advance_limit);

    const txs = await Data.listTransactions(id);
    const ledgerBody = document.getElementById('ledgerTable');
    document.getElementById('ledgerEmpty').style.display = txs.length ? 'none' : 'block';
    ledgerBody.innerHTML = txs.map(t => `
      <tr>
        <td>${fmtDate(t.transaction_date)}</td>
        <td>${TYPE_LABELS[t.type] || t.type}${t.category ? ' — ' + t.category : ''}${t.overridden_limit ? ' <span class="pill warn">تجاوز الحد</span>' : ''}</td>
        <td class="num">${fmtMoney(t.amount)}</td>
        <td>${t.description || ''}</td>
      </tr>`).join('');
  } catch(err){
    document.getElementById('detailAlert').innerHTML = `<div class="alert">تعذّر تحميل بيانات العامل. (${err.message || err})</div>`;
  }
}

// ---------------- تسجيل عملية ----------------
document.getElementById('btnSubmitTx')?.addEventListener('click', () => submitTransaction(false));

async function submitTransaction(overrideLimit){
  const type = document.getElementById('txType').value;
  const amount = Number(document.getElementById('txAmount').value);
  const description = document.getElementById('txDescription').value.trim();
  const date = document.getElementById('txDate').value || todayISO();
  if(!(amount > 0)){ alert('أدخل مبلغًا صحيحًا أكبر من صفر'); return; }

  try{
    if(type === 'withdrawal'){
      const result = await recordWithdrawal({ workerId, amount, description, overrideLimit, date });
      let msg = '';
      if(result.paymentPart > 0) msg += `تم تسجيل دفعة بقيمة ${fmtMoney(result.paymentPart)}. `;
      if(result.advancePart > 0) msg += `تم تسجيل سلفة إضافية بقيمة ${fmtMoney(result.advancePart)}.`;
      alert(msg || 'تم تسجيل العملية');
    } else if(type === 'salary'){
      const pMonth = Number(document.getElementById('txSalaryMonth').value);
      const pYear = Number(document.getElementById('txSalaryYear').value);
      await Data.insertTransaction({
        worker_id: workerId, type:'salary', amount,
        description: description || `راتب ${MONTH_NAMES[pMonth-1]} ${pYear}`,
        period_year: pYear, period_month: pMonth,
        transaction_date: date, created_by:'المدير',
      });
    } else {
      const category = CATEGORY_OPTIONS[type] ? document.getElementById('txCategory').value : null;
      await Data.insertTransaction({
        worker_id: workerId, type, amount, description, category,
        transaction_date: date, created_by:'المدير',
      });
    }
    document.getElementById('txAmount').value = '';
    document.getElementById('txDescription').value = '';
    loadWorkerDetail(workerId);
  } catch(err){
    if(err.code === 'exceeds_limit'){
      const d = err.details;
      document.getElementById('limitModalText').textContent =
        `المستحق المتاح: ${fmtMoney(d.dueBalance)} — السلفة الحالية: ${fmtMoney(d.currentAdvance)} — حد السلفة: ${fmtMoney(d.advanceLimit)}. ` +
        `المبلغ المطلوب كسلفة إضافية (${fmtMoney(d.advancePart)}) سيرفع رصيد السلفة إلى ${fmtMoney(d.newAdvanceTotal)}، وهو أعلى من الحد المسموح.`;
      document.getElementById('limitModal').classList.add('open');
    } else {
      alert('تعذّر تسجيل العملية: ' + (err.message || err));
    }
  }
}

document.getElementById('btnCancelOverride')?.addEventListener('click', () => document.getElementById('limitModal').classList.remove('open'));
document.getElementById('btnConfirmOverride')?.addEventListener('click', () => {
  document.getElementById('limitModal').classList.remove('open');
  submitTransaction(true);
});
