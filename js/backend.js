/* ZTREND Supabase client bootstrap.
   Publishable key is intended for browser use; database access is protected by RLS.
   Never put a Supabase Secret / Service Role key in this file. */
(function () {
  const SUPABASE_URL = 'https://unmhomsilbvmymepdqvf.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_mOZy_s_5Pe_I8miDetIU2g_T6FYNWKa';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('ZTREND: Supabase library did not load.');
    window.ZTrendBackend = { provider: 'supabase', ready: false, error: 'Supabase library unavailable' };
    return;
  }

  const portal = document.body?.dataset?.portal || 'unknown';
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storageKey: 'ztrend-' + portal + '-auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  window.ZTrendBackend = {
    provider: 'supabase',
    ready: true,
    client: client,
    url: SUPABASE_URL
  };
  console.info('ZTREND: Supabase client initialized.');
})();
