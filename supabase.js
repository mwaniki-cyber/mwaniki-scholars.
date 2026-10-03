import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =====================================================
// MWANIKI SCHOLARS
// SUPABASE CONNECTION
// =====================================================

const SUPABASE_URL =
    "https://bazixdwtysmkkdeloerx.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_LfHAT9AAQ03BAyo1bQhVTg_Agk7MmjB";

// =====================================================
// CREATE SUPABASE CLIENT
// =====================================================

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// =====================================================
// EXPORT FOR MODULE-BASED FILES
// =====================================================

export { supabase };

// =====================================================
// GLOBAL CLIENT
// Keeps compatibility with existing Mwaniki Scholars
// pages such as community.js
// =====================================================

window.supabase = supabase;
window.supabaseClient = supabase;
window.sb = supabase;
window.mwanikiSupabase = supabase;

// =====================================================
// CONNECTION MESSAGE
// =====================================================

console.log("✅ Mwaniki Scholars Supabase Connected");
console.log("✅ Global Supabase client available")
