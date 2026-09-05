// ============================================================
// إعداد الاتصال بـ Supabase
// ============================================================
const SUPABASE_URL = 'https://jvpthhuxipxomgqootzg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2cHRoaHV4aXB4b21ncW9vdHpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NjEzNDgsImV4cCI6MjEwNDEzNzM0OH0.GY5qMGJrPCYmStuPAUTnYVZiDnmtLAKpy36ccXvdLs4';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
