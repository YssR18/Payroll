// ============================================================
// auth.js — يحمي الصفحة: يتحقق من تسجيل الدخول قبل عرض المحتوى،
// ويعيد المستخدم لصفحة الدخول إن لم يكن مسجَّلاً. يوضع بعد
// supabaseClient.js وقبل app.js في كل صفحة محمية.
// ============================================================
(async function requireAuth(){
  const { data } = await supabaseClient.auth.getSession();
  if(!data.session){
    location.href = 'login.html';
    return;
  }
  // يُظهر محتوى الصفحة فقط بعد التأكد من تسجيل الدخول
  document.documentElement.style.visibility = 'visible';
})();

// يُستخدم من زر "تسجيل الخروج" في كل صفحة
async function logout(){
  await supabaseClient.auth.signOut();
  location.href = 'login.html';
}
