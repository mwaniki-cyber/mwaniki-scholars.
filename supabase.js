/* ============================================================
   MWANIKI SCHOLARS
   SUPABASE CLIENT
   Classic browser build
   ============================================================ */

(function () {
    "use strict";

    const SUPABASE_URL =
        "https://bazixdwtysmkkdeloerx.supabase.co";

    const SUPABASE_PUBLISHABLE_KEY =
        "sb_publishable_LfHAT9AAQ03BAyo1bQhVTg_Agk7MmjB";

    function createMwanikiClient() {

        /*
         * The CDN library is stored temporarily in
         * window.supabase before we replace it with
         * the actual Supabase client.
         */

        const library = window.supabase;

        if (
            !library ||
            typeof library.createClient !== "function"
        ) {
            console.error(
                "❌ Supabase browser library is unavailable."
            );

            return false;
        }

        try {

            const client = library.createClient(
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
             * Mwaniki Scholars global aliases.
             */

            window.supabaseClient = client;
            window.sb = client;
            window.mwanikiSupabase = client;
            window.mwanikiSupabaseClient = client;

            /*
             * Existing Mwaniki Scholars files expect
             * window.supabase to be the CLIENT.
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

            window.dispatchEvent(
                new Event("mwaniki-supabase-ready")
            );

            return true;

        } catch (error) {

            console.error(
                "❌ Supabase client creation failed:",
                error
            );

            window.mwanikiSupabaseError = true;

            return false;
        }
    }

    /*
     * The CDN should already be loaded.
     */

    if (createMwanikiClient()) {
        return;
    }

    /*
     * If the library was not available, wait briefly for
     * the browser CDN script to finish loading.
     */

    let attempts = 0;

    const waitForLibrary = setInterval(function () {

        attempts++;

        if (createMwanikiClient()) {
            clearInterval(waitForLibrary);
            return;
        }

        if (attempts >= 50) {

            clearInterval(waitForLibrary);

            console.error(
                "❌ Supabase browser library could not be loaded."
            );

            console.error(
                "Check the Supabase CDN script in community.html."
            );
        }

    }, 100);

})();
