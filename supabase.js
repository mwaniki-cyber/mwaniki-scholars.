/* ============================================================
   MWANIKI SCHOLARS
   SUPABASE CLIENT
   ============================================================

   IMPORTANT:
   This file is intentionally a NORMAL browser script.

   Do NOT use:
       import { createClient } from "...";

   Supabase JS is loaded by community-calls.html before this file.

   This creates one global Supabase client used by:
       community.js
       community-calls.js
       other Mwaniki Scholars pages
   ============================================================ */

(function () {

    "use strict";

    /* =========================================================
       CONFIGURATION
       ========================================================= */

    const SUPABASE_URL =
        "https://bazixdwtysmkkdeloerx.supabase.co";

    const SUPABASE_PUBLISHABLE_KEY =
        "sb_publishable_LfHAT9AAQ03BAyo1bQhVTg_Agk7MmjB";


    /* =========================================================
       SAFETY CHECK
       ========================================================= */

    if (
        typeof window.supabase !== "object" &&
        typeof window.supabase !== "function"
    ) {

        console.error(
            "❌ Supabase library has not been loaded."
        );

        console.error(
            "Load the Supabase CDN script before supabase.js."
        );

        return;
    }


    /* =========================================================
       PREVENT DUPLICATE CLIENTS
       ========================================================= */

    if (
        window.supabaseClient &&
        typeof window.supabaseClient.from === "function"
    ) {

        console.log(
            "✅ Existing Mwaniki Scholars Supabase client reused"
        );

        window.mwanikiSupabase =
            window.supabaseClient;

        window.sb =
            window.supabaseClient;

        return;
    }


    /* =========================================================
       CREATE CLIENT
       ========================================================= */

    let client;

    try {

        client =
            window.supabase.createClient(
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

    } catch (error) {

        console.error(
            "❌ Failed to create Supabase client:",
            error
        );

        return;
    }


    /* =========================================================
       GLOBAL ACCESS
       ========================================================= */

    window.supabaseClient =
        client;

    window.sb =
        client;

    window.mwanikiSupabase =
        client;


    /*
     * Keep window.supabase pointing to the CLIENT after the
     * library has been initialized.
     *
     * The original Supabase library object is no longer needed
     * by the rest of the Mwaniki application.
     */
    window.supabase =
        client;


    /* =========================================================
       READY FLAG
       ========================================================= */

    window.mwanikiSupabaseReady =
        true;


    /* =========================================================
       LOGGING
       ========================================================= */

    console.log(
        "✅ Mwaniki Scholars Supabase Connected"
    );

    console.log(
        "✅ Global Supabase client available"
    );

})();
