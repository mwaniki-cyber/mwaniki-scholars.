/* ============================================================
   MWANIKI SCHOLARS — SHARED SUPABASE CLIENT
   ============================================================ */

import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  "https://bazixdwtysmkkdeloerx.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_LfHAT9AAQ03BAyo1bQhVTg_Agk7MmjB";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce"
    }
  }
);

// Publish aliases for older scripts.
window.supabase = supabase;
window.supabaseClient = supabase;
window.mwanikiSupabase = supabase;
window.mwanikiSupabaseClient = supabase;
window.sb = supabase;

window.mwanikiSupabaseReady = true;
window.mwanikiSupabaseError = false;

console.log(
  "✅ Mwaniki Scholars Supabase client initialized"
);

window.dispatchEvent(
  new CustomEvent("mwaniki-supabase-ready", {
    detail: { client: supabase }
  })
);

export { supabase };
export default supabase;
