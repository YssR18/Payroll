const now = new Date();
const selYear = document.getElementById('selYear');
const selMonth = document.getElementById('selMonth');

for(let y = now.getFullYear() - 1; y <= now.getFullYear() + 1; y++){
  selYear.innerHTML += `<option value="${y}" ${y === now.getFullYear() ? 'selected':''}>${y}</option>`;
}
MONTH_NAMES.forEach((m, i) => {
  selMonth.innerHTML += `<option value="${i+1}" ${i+1 === now.getMonth()+1 ? 'selected':''}>${m}</option>`;
});

document.getElementById('btnLoadMonth').addEventListener('click', loadMonth);
document.getElementById('btnGenerate').addEventListener('click', generateMonth);
document.getElementById('btnClose').addEventListener('click', closeMonth);

loadMonth();

function currentSelection(){
  return { year: Number(selYear.value), month: Number(selMonth.value) };
}

async function loadMonth(){
  const { year, month } = currentSelection();
  document.getElementById('monthTitle').textContent = `${MONTH_NAMES[month-1]} ${year}`;

  try{
    const period = await Data.getPeriod(year, month);
    const statusEl = document.getElementById('periodStatus');
    if(!period){
      statusEl.innerHTML = `<div class="helper">لم يتم توليد رواتب هذا الشهر بعد.</div>`;
    } else if(period.closed){
      statusEl.innerHTML = `<div class="pill warn">تم إغلاق هذا الشهر بتاريخ ${fmtDate(period.closed_at)}</div>`;
    } else {
      statusEl.innerHTML = `<div class="pill ok">تم توليد رواتب هذا الشهر — لم يُغلق بعد</div>`;
    }
    document.getElementById('btnGenerate').disabled = !!period;
    document.getElementById('btnClose').disabled = !period || period.closed;

    const [txs, balances] = await Promise.all([Data.monthTransactions(year, month), Data.listBalances()]);
    const balMap = Object.fromEntries(balances.map(b => [b.worker_id, b]));

    const byWorker = {};
    for(const t of txs){
      const key = t.worker_id;
      byWorker[key] = byWorker[key] || { name: t.workers?.full_name, salary:0, additions:0, deductions:0 };
      if(t.type === 'salary') byWorker[key].salary += Number(t.amount);
      if(t.type === 'addition') byWorker[key].additions += Number(t.amount);
      if(t.type === 'deduction') byWorker[key].deductions += Number(t.amount);
    }

    const rows = Object.entries(byWorker);
    document.getElementById('monthEmpty').style.display = rows.length ? 'none' : 'block';
    document.getElementById('monthTable').innerHTML = rows.map(([workerId, r]) => {
      const due = r.salary + r.additions - r.deductions;
      const b = balMap[workerId];
      const cumulativeRemaining = b ? Number(b.accrued_salary) - Number(b.total_paid) : 0;
      return `<tr>
        <td><a class="worker-link" href="workers.html?id=${workerId}">${r.name}</a></td>
        <td class="num">${fmtMoney(r.salary)}</td>
        <td class="num">${fmtMoney(r.additions)}</td>
        <td class="num">${fmtMoney(r.deductions)}</td>
        <td class="num">${fmtMoney(due)}</td>
        <td class="num">${fmtMoney(cumulativeRemaining)}</td>
      </tr>`;
    }).join('');

  } catch(err){
    document.getElementById('alertBox').innerHTML = `<div class="alert">تعذّر تحميل بيانات الشهر. (${err.message || err})</div>`;
  }
}

async function generateMonth(){
  const { year, month } = currentSelection();
  if(!confirm(`سيتم إنشاء راتب مستحق لكل عامل نشط لشهر ${MONTH_NAMES[month-1]} ${year}. متابعة؟`)) return;

  try{
    const existing = await Data.getPeriod(year, month);
    if(existing){ alert('تم توليد رواتب هذا الشهر مسبقًا'); return; }

    const workers = await Data.listWorkers({ activeOnly: true });
    for(const w of workers){
      await Data.insertTransaction({
        worker_id: w.id, type:'salary', amount: w.base_salary,
        description: `راتب ${MONTH_NAMES[month-1]} ${year}`,
        period_year: year, period_month: month,
        transaction_date: `${year}-${String(month).padStart(2,'0')}-01`,
        created_by:'المدير',
      });
    }
    await supabaseClient.from('monthly_periods').insert({ period_year: year, period_month: month });
    loadMonth();
  } catch(err){
    alert('تعذّر توليد رواتب الشهر: ' + (err.message || err));
  }
}

async function closeMonth(){
  const { year, month } = currentSelection();
  if(!confirm(`تأكيد إغلاق شهر ${MONTH_NAMES[month-1]} ${year}؟ هذه عملية محاسبية، تأكد من مراجعة الأرقام قبل المتابعة.`)) return;

  try{
    const period = await Data.getPeriod(year, month);
    if(!period){ alert('لم يتم توليد رواتب هذا الشهر بعد'); return; }
    await supabaseClient.from('monthly_periods').update({ closed:true, closed_at:new Date().toISOString() }).eq('id', period.id);
    loadMonth();
  } catch(err){
    alert('تعذّر إغلاق الشهر: ' + (err.message || err));
  }
}
