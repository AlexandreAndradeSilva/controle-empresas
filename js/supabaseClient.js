const { url, anonKey } = window.SUPABASE_CONFIG || {};

export const supabase = window.supabase.createClient(url, anonKey);
