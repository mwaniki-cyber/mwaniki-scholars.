/* ============================================================
   MWANIKI SCHOLARS
   SUPABASE GLOBAL CLIENT
   Classic-script version
   ============================================================ */

(function () {
    "use strict";

    const SUPABASE_URL =
        "https://bazixdwtysmkkdeloerx.supabase.co";

    const SUPABASE_PUBLISHABLE_KEY =
        "sb_publishable_LfHAT9AAQ03BAyo1bQhVTg_Agk7MmjB";

    /*
     * The Supabase CDN library normally creates:
     *
     * window.supabase
     *
     * We capture the library BEFORE replacing window.supabase
     * with our actual client.
     */

    const supabaseLibrary = window.supabase;

    if (
        !supabaseLibrary ||
        typeof supabaseLibrary.createClient !== "function"
    ) {
        console.error(
            "❌ Supabase CDN library is not available."
        );

        console.error(
            "Make sure the Supabase CDN script appears BEFORE supabase.js."
        );

        /*
         * Do NOT throw here.
         *
         * This is important because other Mwaniki Scholars
         * scripts should still be able to wait for the client.
         */

        window.mwanikiSupabaseError = true;

        return;
    }

    try {

        const client = supabaseLibrary.createClient(
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

        /*
         * Global aliases used throughout Mwaniki Scholars.
         */

        window.supabaseClient = client;
        window.sb = client;
        window.mwanikiSupabase = client;
        window.mwanikiSupabaseClient = client;

        /*
         * Keep window.supabase pointing to the CLIENT.
         *
         * Your existing community.js and other files already
         * expect this.
         */

        window.supabase = client;

        window.mwanikiSupabaseReady = true;
        window.mwanikiSupabaseError = false;

        console.log(
            "✅ Mwaniki Scholars Supabase Connected"
        );

        console.log(
            "✅ Global Supabase client available"
        );

        /*
         * Tell scripts that may have started waiting for Supabase.
         */

        window.dispatchEvent(
            new CustomEvent("mwaniki-supabase-ready")
        );

    } catch (error) {

        console.error(
            "❌ Failed to create Supabase client:",
            error
        );

        window.mwanikiSupabaseError = true;
    }

})();
