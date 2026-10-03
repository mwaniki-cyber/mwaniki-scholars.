// ============================================================
// MWANIKI SCHOLARS
// SUPABASE CLIENT
// ============================================================

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

// Global access
window.supabase = supabase;
window.supabaseClient = supabase;
window.sb = supabase;
window.mwanikiSupabase = supabase;

console.log("✅ Mwaniki Scholars Supabase Connected");
console.log("✅ Global Supabase client available");

export { supabase };
