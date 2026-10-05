/* ============================================================
   MWANIKI SCHOLARS
   SUPABASE CLIENT
   Stable browser loader
   ============================================================ */

(function () {
    "use strict";

    const SUPABASE_URL =
        "https://bazixdwtysmkkdeloerx.supabase.co";

    const SUPABASE_PUBLISHABLE_KEY =
        "sb_publishable_LfHAT9AAQ03BAyo1bQhVTg_Agk7MmjB";

    const SUPABASE_CDN =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

    /* ---------------------------------------------------------
       Prevent duplicate initialization
       --------------------------------------------------------- */

    if (window.mwanikiSupabaseReady === true) {
        console.log(
            "✅ Mwaniki Scholars Supabase already initialized"
        );
        return;
    }

    /* ---------------------------------------------------------
       Create the actual Supabase client
       --------------------------------------------------------- */

    function initializeSupabase(library) {

        if (
            !library ||
            typeof library.createClient !== "function"
        ) {
            console.error(
                "❌ Invalid Supabase browser library."
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
             * Store the client under the aliases used by
             * Mwaniki Scholars.
             */

            window.supabaseClient = client;

            window.mwanikiSupabase = client;

            window.mwanikiSupabaseClient = client;

            window.sb = client;

            /*
             * IMPORTANT:
             *
             * Existing Mwaniki Scholars files use:
             *
             * window.supabase
             *
             * as the CLIENT.
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
             * Notify community.js and other scripts.
             */

            window.dispatchEvent(
                new CustomEvent(
                    "mwaniki-supabase-ready"
                )
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

    /* ---------------------------------------------------------
       If a Supabase library is already available
       --------------------------------------------------------- */

    if (
        window.supabase &&
        typeof window.supabase.createClient === "function"
    ) {

        initializeSupabase(window.supabase);

        return;
    }

    /* ---------------------------------------------------------
       Dynamically load Supabase
       --------------------------------------------------------- */

    const existingLoader =
        document.querySelector(
            'script[data-mwaniki-supabase-loader="true"]'
        );

    if (existingLoader) {

        existingLoader.addEventListener(
            "load",
            function () {

                if (
                    window.supabase &&
                    typeof window.supabase.createClient ===
                        "function"
                ) {

                    initializeSupabase(
                        window.supabase
                    );

                } else {

                    console.error(
                        "❌ Supabase CDN loaded but did not expose createClient."
                    );
                }
            },
            {
                once: true
            }
        );

        return;
    }

    /* ---------------------------------------------------------
       Create CDN script
       --------------------------------------------------------- */

    const script =
        document.createElement("script");

    script.src = SUPABASE_CDN;

    script.async = false;

    script.dataset.mwanikiSupabaseLoader = "true";

    script.onload = function () {

        /*
         * jsDelivr UMD build should expose createClient
         * through window.supabase.
         */

        if (
            window.supabase &&
            typeof window.supabase.createClient ===
                "function"
        ) {

            initializeSupabase(
                window.supabase
            );

            return;
        }

        /*
         * Some builds expose the library differently.
         */

        if (
            window.supabaseJs &&
            typeof window.supabaseJs.createClient ===
                "function"
        ) {

            initializeSupabase(
                window.supabaseJs
            );

            return;
        }

        console.error(
            "❌ Supabase CDN loaded, but createClient was not found."
        );

        console.error(
            "Supabase global:",
            window.supabase
        );

        window.mwanikiSupabaseError = true;
    };

    script.onerror = function () {

        console.error(
            "❌ Unable to load Supabase CDN."
        );

        console.error(
            "CDN URL:",
            SUPABASE_CDN
        );

        window.mwanikiSupabaseError = true;
    };

    document.head.appendChild(script);

})();
