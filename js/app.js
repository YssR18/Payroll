// ============================================================
// app.js — دوال مشتركة تُستخدم في كل صفحات التطبيق
// ============================================================

const MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function fmtMoney(n){
  const v = Number(n || 0);
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' DZD';
}

function fmtDate(d){
  if(!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB');
}

function todayISO(){
  return new Date().toISOString().slice(0,10);
}

function highlightActiveNav(){
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .mobile-nav a').forEach(a=>{
    if(a.getAttribute('href') === page) a.classList.add('active');
  });
}
document.addEventListener('DOMContentLoaded', highlightActiveNav);

const Data = {
  async listWorkers({ activeOnly = false } = {}){
    let q = supabaseClient.from('workers').select('*').order('employee_code');
    if(activeOnly) q = q.eq('status','active');
    const { data, error } = await q;
    if(error) throw error;
    return data;
  },

  async getWorker(id){
    const { data, error } = await supabaseClient.from('workers').select('*').eq('id', id).single();
    if(error) throw error;
    return data;
  },

  async createWorker(worker){
    const { data, error } = await supabaseClient.from('workers').insert(worker).select().single();
    if(error) throw error;
    return data;
  },

  async updateWorker(id, patch){
    const { data, error } = await supabaseClient.from('workers').update(patch).eq('id', id).select().single();
    if(error) throw error;
    return data;
  },

  // يحذف العامل نهائيًا من قاعدة البيانات. بفضل ON DELETE CASCADE في الجدول،
  // سيُحذف تلقائيًا كل السجل المالي (transactions) المرتبط بهذا العامل.
  async deleteWorker(id){
    const { error } = await supabaseClient.from('workers').delete().eq('id', id);
    if(error) throw error;
  },

  async listBalances(){
    const { data, error } = await supabaseClient.from('worker_balances').select('*');
    if(error) throw error;
    return data;
  },

  async getBalance(workerId){
    const { data, error } = await supabaseClient.from('worker_balances').select('*').eq('worker_id', workerId).single();
    if(error) throw error;
    return data;
  },

  async listTransactions(workerId){
    const { data, error } = await supabaseClient
      .from('transactions').select('*')
      .eq('worker_id', workerId)
      .order('transaction_date', { ascending:false })
      .order('created_at', { ascending:false });
    if(error) throw error;
    return data;
  },

  async recentTransactions(limit = 15){
    const { data, error } = await supabaseClient
      .from('transactions').select('*, workers(full_name, employee_code)')
      .order('created_at', { ascending:false })
      .limit(limit);
    if(error) throw error;
    return data;
  },

  async insertTransaction(tx){
    const { data, error } = await supabaseClient.from('transactions').insert(tx).select().single();
    if(error) throw error;
    return data;
  },

  async monthTransactions(year, month){
    const { data, error } = await supabaseClient
      .from('transactions').select('*, workers(full_name, employee_code, base_salary)')
      .eq('period_year', year).eq('period_month', month);
    if(error) throw error;
    return data;
  },

  async getPeriod(year, month){
    const { data, error } = await supabaseClient
      .from('monthly_periods').select('*')
      .eq('period_year', year).eq('period_month', month)
      .maybeSingle();
    if(error) throw error;
    return data;
  },

  async listPeriods(){
    const { data, error } = await supabaseClient.from('monthly_periods').select('*').order('period_year',{ascending:false}).order('period_month',{ascending:false});
    if(error) throw error;
    return data;
  },
};

// ------------------------------------------------------------
// منطق محاسبي: تسجيل حركة "سحب" (دفعة و/أو سلفة) — يطبّق قاعدة
// "الدفعة من المستحق أولاً، والباقي سلفة إضافية" الموضّحة في الخطة.
// يرجع تفصيل ما تم تسجيله حتى تُعرض رسالة واضحة للمستخدم.
// ------------------------------------------------------------
async function recordWithdrawal({ workerId, amount, description, overrideLimit = false, createdBy = 'المدير', date }){
  date = date || todayISO();
  amount = Number(amount);
  if(!(amount > 0)) throw new Error('المبلغ يجب أن يكون أكبر من صفر');

  const balance = await Data.getBalance(workerId);
  const dueBalance = Number(balance.accrued_salary) - Number(balance.total_paid);
  const currentAdvance = Number(balance.advance_balance);
  const advanceLimit = Number(balance.advance_limit);

  const paymentPart = Math.min(amount, Math.max(dueBalance, 0));
  const advancePart = amount - paymentPart;

  if(advancePart > 0 && !overrideLimit){
    const newAdvanceTotal = currentAdvance + advancePart;
    if(newAdvanceTotal > advanceLimit){
      const err = new Error('exceeds_limit');
      err.code = 'exceeds_limit';
      err.details = { dueBalance, advanceLimit, currentAdvance, advancePart, newAdvanceTotal };
      throw err;
    }
  }

  const inserted = [];
  if(paymentPart > 0){
    inserted.push(await Data.insertTransaction({
      worker_id: workerId, type:'payment', amount: paymentPart,
      description: description || 'دفعة من الراتب المستحق',
      transaction_date: date, created_by: createdBy,
    }));
  }
  if(advancePart > 0){
    inserted.push(await Data.insertTransaction({
      worker_id: workerId, type:'advance', amount: advancePart,
      description: description || 'سلفة إضافية',
      transaction_date: date, created_by: createdBy,
      overridden_limit: overrideLimit,
    }));
  }
  return { paymentPart, advancePart, inserted };
}
