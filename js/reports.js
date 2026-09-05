const TYPE_LABELS = {
  salary:'راتب', addition:'إضافة', deduction:'اقتطاع',
  payment:'دفعة', advance:'سلفة', advance_repayment:'سداد سلفة'
};

async function loadTotals(){
  const balances = await Data.listBalances();
  const totalDue = balances.reduce((s,b)=> s + Number(b.accrued_salary), 0);
  const totalPaid = balances.reduce((s,b)=> s + Number(b.total_paid), 0);
  const totalAdvance = balances.reduce((s,b)=> s + Number(b.advance_balance), 0);
  const rows = [
    ['عدد العمال', balances.length],
    ['إجمالي الرواتب المستحقة (تراكمي)', fmtMoney(totalDue)],
    ['إجمالي المبالغ المدفوعة', fmtMoney(totalPaid)],
    ['إجمالي السلف القائمة', fmtMoney(totalAdvance)],
    ['إجمالي المتبقي على المؤسسة للعمال', fmtMoney(totalDue - totalPaid)],
  ];
  document.getElementById('totalsTable').innerHTML = rows.map(([k,v]) => `<tr><td>${k}</td><td class="num">${v}</td></tr>`).join('');
}

async function loadWorkerSelect(){
  const workers = await Data.listWorkers();
  const sel = document.getElementById('selWorker');
  sel.innerHTML = `<option value="">— اختر عاملًا —</option>` +
    workers.map(w => `<option value="${w.id}">${w.employee_code} — ${w.full_name}</option>`).join('');
  sel.addEventListener('change', () => sel.value && loadStatement(sel.value));
}

async function loadStatement(workerId){
  const [w, b, txs] = await Promise.all([Data.getWorker(workerId), Data.getBalance(workerId), Data.listTransactions(workerId)]);
  const due = Number(b.accrued_salary) - Number(b.total_paid);
  document.getElementById('statementHeader').innerHTML = `
    <h3>${w.full_name} <span class="helper">(${w.employee_code})</span></h3>
    <div class="stat-grid">
      <div class="stat"><div class="label">إجمالي المستحق</div><div class="value num">${fmtMoney(b.accrued_salary)}</div></div>
      <div class="stat accent-brass"><div class="label">المدفوع</div><div class="value num">${fmtMoney(b.total_paid)}</div></div>
      <div class="stat"><div class="label">المتبقي</div><div class="value num">${fmtMoney(due)}</div></div>
      <div class="stat accent-brick"><div class="label">السلفة القائمة</div><div class="value num">${fmtMoney(b.advance_balance)}</div></div>
    </div>`;

  document.getElementById('statementEmpty').style.display = txs.length ? 'none' : 'block';
  document.getElementById('statementTable').innerHTML = txs.map(t => `
    <tr>
      <td>${fmtDate(t.transaction_date)}</td>
      <td>${TYPE_LABELS[t.type] || t.type}</td>
      <td class="num">${fmtMoney(t.amount)}</td>
      <td>${t.description || ''}</td>
    </tr>`).join('');
}

document.getElementById('btnPrint').addEventListener('click', () => window.print());

loadTotals();
loadWorkerSelect();
