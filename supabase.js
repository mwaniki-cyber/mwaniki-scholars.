// =====================================================
// MWANIKI SCHOLARS - SUPABASE CONNECTION
// =====================================================
// Browser-compatible Supabase client
// Used by Mwaniki Scholars pages, dashboard, community,
// calls, courses, notes, quizzes, etc.
// =====================================================

(function () {
    "use strict";

    // =================================================
    // SUPABASE PROJECT
    // =================================================

    const SUPABASE_URL =
        "https://bazixdwtysmkkdeloerx.supabase.co";

    const SUPABASE_ANON_KEY =
        "sb_publishable_LfHAT9AAQ03BAyo1bQhVTg_Agk7MmjB";


    // =================================================
    // LOAD SUPABASE LIBRARY
    // =================================================

    function loadSupabaseLibrary() {

        return new Promise(function (resolve, reject) {

            // Already loaded
            if (
                window.supabase &&
                typeof window.supabase.createClient === "function"
            ) {
                resolve(window.supabase);
                return;
            }

            const existingScript =
                document.querySelector(
                    'script[data-mwaniki-supabase="true"]'
                );

            if (existingScript) {

                existingScript.addEventListener(
                    "load",
                    function () {
                        if (
                            window.supabase &&
                            typeof window.supabase.createClient === "function"
                        ) {
                            resolve(window.supabase);
                        } else {
                            reject(
                                new Error(
                                    "Supabase library loaded but createClient is unavailable."
                                )
                            );
                        }
                    }
                );

                existingScript.addEventListener(
                    "error",
                    function () {
                        reject(
                            new Error(
                                "Unable to load the Supabase library."
                            )
                        );
                    }
                );

                return;
            }


            // Load Supabase from jsDelivr
            const script =
                document.createElement("script");

            script.src =
                "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

            script.async = true;

            script.dataset.mwanikiSupabase = "true";


            script.onload = function () {

                if (
                    window.supabase &&
                    typeof window.supabase.createClient === "function"
                ) {
                    resolve(window.supabase);
                } else {
                    reject(
                        new Error(
                            "Supabase library loaded but createClient is unavailable."
                        )
                    );
                }

            };


            script.onerror = function () {

                reject(
                    new Error(
                        "Failed to load Supabase from jsDelivr."
                    )
                );

            };


            document.head.appendChild(script);

        });

    }


    // =================================================
    // INITIALIZE CLIENT
    // =================================================

    loadSupabaseLibrary()

        .then(function (supabaseLibrary) {

            const client =
                supabaseLibrary.createClient(
                    SUPABASE_URL,
                    SUPABASE_ANON_KEY
                );


            // =============================================
            // GLOBAL CLIENT NAMES
            // =============================================

            window.supabaseClient = client;

            window.sb = client;

            window.mwanikiSupabase = client;


            // =============================================
            // CONNECTION INFORMATION
            // =============================================

            window.MWANIKI_SUPABASE_URL =
                SUPABASE_URL;


            // =============================================
            // READY FLAG
            // =============================================

            window.mwanikiSupabaseReady = true;


            // =============================================
            // CUSTOM EVENT
            // =============================================

            window.dispatchEvent(
                new CustomEvent(
                    "mwaniki:supabase-ready",
                    {
                        detail: {
                            client: client
                        }
                    }
                )
            );


            // =============================================
            // CONSOLE
            // =============================================

            console.log(
                "✅ Mwaniki Scholars Supabase Connected"
            );

            console.log(
                "🔗 Supabase URL:",
                SUPABASE_URL
            );

        })


        .catch(function (error) {

            window.mwanikiSupabaseReady = false;

            console.error(
                "❌ Mwaniki Scholars Supabase failed to initialize:",
                error
            );

        });


    // =================================================
    // HELPER
    // =================================================
    // Allows other scripts to safely wait until
    // Supabase has finished loading.
    // =================================================

    window.waitForMwanikiSupabase =
        function () {

            return new Promise(function (resolve, reject) {

                if (
                    window.mwanikiSupabaseReady &&
                    window.supabaseClient
                ) {
                    resolve(
                        window.supabaseClient
                    );

                    return;
                }


                const timeout =
                    setTimeout(
                        function () {

                            reject(
                                new Error(
                                    "Timed out waiting for Supabase."
                                )
                            );

                        },
                        15000
                    );


                window.addEventListener(
                    "mwaniki:supabase-ready",
                    function handler(event) {

                        clearTimeout(timeout);

                        window.removeEventListener(
                            "mwaniki:supabase-ready",
                            handler
                        );


                        resolve(
                            event.detail.client
                        );

                    }
                );

            });

        };

})();
