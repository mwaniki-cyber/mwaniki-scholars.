import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/*
===========================================================
 MWANIKI SCHOLARS — SUPABASE CLIENT
===========================================================
*/

const SUPABASE_URL =
    "https://bazixdwtysmkkdeloerx.supabase.co";

/*
 * IMPORTANT:
 * Paste the CURRENT publishable/anon key from:
 *
 * Supabase Dashboard
 * → Project Settings
 * → API
 *
 * Do NOT use a secret/service-role key here.
 */
const SUPABASE_ANON_KEY =
    "PASTE_YOUR_CURRENT_SUPABASE_PUBLISHABLE_KEY_HERE";


if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY.includes("PASTE_YOUR")
) {

    console.error(
        "❌ Supabase configuration is incomplete."
    );

} else {

    const supabase =
        createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    flowType: "pkce"
                }
            }
        );


    /*
    =======================================================
     GLOBAL CLIENT REFERENCES
    =======================================================
    */

    window.supabase = supabase;

    window.supabaseClient = supabase;

    window.sb = supabase;

    window.mwanikiSupabase = supabase;


    /*
    =======================================================
     EXPORT
    =======================================================
    */

    export { supabase };


    console.log(
        "✅ Mwaniki Scholars Supabase Connected"
    );

    console.log(
        "✅ Global Supabase client available"
    );

}
