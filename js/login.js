// إذا كان المستخدم مسجّل الدخول بالفعل، أرسله مباشرة للوحة التحكم
(async function(){
  const { data } = await supabaseClient.auth.getSession();
  if(data.session){ location.href = 'index.html'; }
})();

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errBox = document.getElementById('loginError');
  errBox.innerHTML = '';

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error){
    errBox.innerHTML = `<div class="alert">تعذّر تسجيل الدخول. تأكد من البريد الإلكتروني وكلمة المرور. (${error.message})</div>`;
    return;
  }
  location.href = 'index.html';
});
