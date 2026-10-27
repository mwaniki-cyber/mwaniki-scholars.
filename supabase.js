
/* ============================================================
   MWANIKI SCHOLARS — SUPABASE CLIENT
   Shared client for the website
   ============================================================ */

import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

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

// ES module and legacy global aliases
window.supabase = supabase;
window.supabaseClient = supabase;
window.mwanikiSupabase = supabase;
window.mwanikiSupabaseClient = supabase;
window.sb = supabase;
window.mwanikiSupabaseReady = true;
window.mwanikiSupabaseError = false;

// Notify scripts that wait for the client
window.dispatchEvent(
  new CustomEvent("mwaniki-supabase-ready", {
    detail: { client: supabase }
  })
);

console.log("✅ Mwaniki Scholars Supabase client initialized");

export { supabase };
export default supabase;
