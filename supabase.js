// ============================================================
// MWANIKI SCHOLARS
// SUPABASE CLIENT
// ============================================================

import { createClient } from
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";


// ------------------------------------------------------------
// SUPABASE PROJECT
// ------------------------------------------------------------

const SUPABASE_URL =
    "https://bazixdwtysmkkdeloerx.supabase.co";


// IMPORTANT:
// This must be your Supabase project's PUBLIC publishable key.
// It is NOT a student's password and is NOT used as a login method.
//
// If this key has been rotated/replaced in:
// Supabase Dashboard → Settings → API
// update only this value.
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_LfHAT9AAQ03BAyo1bQhVTg_Ag7MmjB";


// ------------------------------------------------------------
// CREATE SUPABASE CLIENT
// ------------------------------------------------------------

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


// ------------------------------------------------------------
// GLOBAL ACCESS
// ------------------------------------------------------------

window.supabase = supabase;
window.supabaseClient = supabase;
window.sb = supabase;
window.mwanikiSupabase = supabase;


// ------------------------------------------------------------
// STATUS
// ------------------------------------------------------------

console.log("✅ Mwaniki Scholars Supabase Connected");
console.log("✅ Global Supabase client available");


// ------------------------------------------------------------
// EXPORT
// ------------------------------------------------------------

export { supabase };
