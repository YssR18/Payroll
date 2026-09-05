document.getElementById('todayLabel').textContent = fmtDate(todayISO());

const TYPE_LABELS = {
  salary:'راتب', addition:'إضافة', deduction:'اقتطاع',
  payment:'دفعة', advance:'سلفة', advance_repayment:'سداد سلفة'
};

async function loadDashboard(){
  try{
    const balances = await Data.listBalances();

    const activeCount = balances.length;
    const totalDue = balances.reduce((s,b)=> s + Number(b.accrued_salary), 0);
    const totalPaid = balances.reduce((s,b)=> s + Number(b.total_paid), 0);
    const totalAdvance = balances.reduce((s,b)=> s + Number(b.advance_balance), 0);
    const totalRemaining = totalDue - totalPaid;

    const grid = document.getElementById('statGrid');
    grid.children[0].querySelector('.value').textContent = activeCount;
    grid.children[1].querySelector('.value').textContent = fmtMoney(totalDue);
    grid.children[2].querySelector('.value').textContent = fmtMoney(totalPaid);
    grid.children[3].querySelector('.value').textContent = fmtMoney(totalAdvance);
    grid.children[4].querySelector('.value').textContent = fmtMoney(totalRemaining);

    const withAdvance = balances.filter(b => Number(b.advance_balance) > 0);
    const advBody = document.getElementById('advancesTable');
    document.getElementById('advancesEmpty').style.display = withAdvance.length ? 'none' : 'block';
    advBody.innerHTML = withAdvance.map(b => `
      <tr>
        <td><a class="worker-link" href="workers.html?id=${b.worker_id}">${b.full_name}</a></td>
        <td class="num">${fmtMoney(b.advance_balance)}</td>
        <td class="num">${fmtMoney(b.advance_limit)}</td>
      </tr>`).join('');

    const recent = await Data.recentTransactions(15);
    const recBody = document.getElementById('recentTable');
    document.getElementById('recentEmpty').style.display = recent.length ? 'none' : 'block';
    recBody.innerHTML = recent.map(t => `
      <tr>
        <td>${fmtDate(t.transaction_date)}</td>
        <td><a class="worker-link" href="workers.html?id=${t.worker_id}">${t.workers?.full_name || ''}</a></td>
        <td>${TYPE_LABELS[t.type] || t.type}</td>
        <td class="num">${fmtMoney(t.amount)}</td>
        <td>${t.description || ''}</td>
      </tr>`).join('');

  } catch(err){
    document.getElementById('alertBox').innerHTML =
      `<div class="alert">تعذّر تحميل البيانات. تأكد من ضبط رابط ومفتاح Supabase في js/supabaseClient.js وتنفيذ sql/schema.sql. (${err.message || err})</div>`;
  }
}

loadDashboard();
