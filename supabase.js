import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =====================================================
// MWANIKI SCHOLARS - SUPABASE CONNECTION
// =====================================================

// Replace these with your project's values
const SUPABASE_URL = "https://bazixdwtysmkkdeloerx.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_LfHAT9AAQ03BAyo1bQhVTg_Agk7MmjB";


// =====================================================
// CREATE SUPABASE CLIENT
// =====================================================

export const supabase =
    createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );


// =====================================================
// CONNECTION MESSAGE
// =====================================================

console.log(
    "✅ Mwaniki Scholars Supabase Connected"
);