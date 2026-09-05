// ============================================================
// إعداد الاتصال بـ Supabase
// ============================================================
const SUPABASE_URL = 'ضع_رابط_مشروعك_هنا';
const SUPABASE_ANON_KEY = 'ضع_مفتاح_anon_هنا';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
