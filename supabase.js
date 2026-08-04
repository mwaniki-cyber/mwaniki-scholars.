// =====================================
// MWANIKI SCHOLARS SUPABASE CONNECTION
// =====================================


import { createClient } from 
"https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";


// SUPABASE PROJECT URL

const supabaseUrl = 
"https://bazixdwtysmkkdeloerx.supabase.co";


// PASTE YOUR SUPABASE PUBLISHABLE KEY HERE

const supabaseKey = 
"sb_publishable_LfHAT9AAQ03BAyo1bQhVTg_Agk7MmjB";



// CREATE SUPABASE CONNECTION

export const supabase = createClient(
    supabaseUrl,
    supabaseKey
);



console.log("✅ Mwaniki Scholars Supabase Connected");