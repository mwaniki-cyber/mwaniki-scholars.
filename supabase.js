/* ============================================================
   MWANIKI SCHOLARS
   SUPABASE CLIENT
   Stable browser + ES module loader
   ============================================================ */

const SUPABASE_URL =
    "https://bazixdwtysmkkdeloerx.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_LfHAT9AAQ03BAyo1bQhVTg_Agk7MmjB";

const SUPABASE_CDN =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

/* ============================================================
   INTERNAL STATE
   ============================================================ */

let supabaseClient = null;

let supabaseReadyPromise = null;

/* ============================================================
   GET SUPABASE LIBRARY
   ============================================================ */

function getSupabaseLibrary() {

    /*
     * The CDN UMD build normally exposes:
     *
     * window.supabase.createClient
     *
     * However, Mwaniki Scholars also uses:
     *
     * window.supabase
     *
     * for the actual CLIENT.
     *
     * Therefore we first check whether another library alias
     * exists before loading anything.
     */

    if (
        window.supabaseJs &&
        typeof window.supabaseJs.createClient === "function"
    ) {

        return window.supabaseJs;

    }

    /*
     * If window.supabase currently contains the Supabase
     * library rather than our client, use it.
     */

    if (
        window.supabase &&
        typeof window.supabase.createClient === "function"
    ) {

        return window.supabase;

    }

    return null;
}

/* ============================================================
   INSTALL GLOBAL CLIENT ALIASES
   ============================================================ */

function installSupabaseClient(client) {

    if (!client) {
        return false;
    }

    supabaseClient = client;

    /*
     * Main application client.
     */

    window.supabaseClient = client;

    window.mwanikiSupabase = client;

    window.mwanikiSupabaseClient = client;

    window.sb = client;

    /*
     * IMPORTANT:
     *
     * Mwaniki Scholars pages already use:
     *
     * window.supabase
     *
     * as the actual client.
     */

    window.supabase = client;

    window.mwanikiSupabaseReady = true;

    window.mwanikiSupabaseError = false;

    /*
     * Notify pages waiting for initialization.
     */

    window.dispatchEvent(
        new CustomEvent(
            "mwaniki-supabase-ready",
            {
                detail: {
                    client: client
                }
            }
        )
    );

    console.log(
        "✅ Mwaniki Scholars Supabase Connected"
    );

    console.log(
        "✅ Global Supabase client available"
    );

    return true;
}

/* ============================================================
   CREATE CLIENT
   ============================================================ */

function createSupabaseClient(library) {

    if (
        !library ||
        typeof library.createClient !== "function"
    ) {

        throw new Error(
            "Supabase browser library does not provide createClient()."
        );
    }

    /*
     * Prevent duplicate clients.
     */

    if (supabaseClient) {
        return supabaseClient;
    }

    /*
     * If the page already has our initialized client,
     * reuse it.
     */

    if (
        window.mwanikiSupabaseReady === true &&
        window.supabaseClient
    ) {

        supabaseClient =
            window.supabaseClient;

        return supabaseClient;
    }

    const client =
        library.createClient(
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

    installSupabaseClient(client);

    return client;
}

/* ============================================================
   LOAD SUPABASE CDN
   ============================================================ */

function loadSupabaseLibrary() {

    /*
     * Check whether the library is already available.
     */

    const existingLibrary =
        getSupabaseLibrary();

    if (existingLibrary) {

        try {

            const client =
                createSupabaseClient(
                    existingLibrary
                );

            return Promise.resolve(client);

        } catch (error) {

            console.error(
                "❌ Failed to initialize existing Supabase library:",
                error
            );
        }
    }

    /*
     * If another loader is already running, wait for it.
     */

    const existingLoader =
        document.querySelector(
            'script[data-mwaniki-supabase-loader="true"]'
        );

    if (existingLoader) {

        return new Promise(
            function (resolve, reject) {

                let finished = false;

                function checkLibrary() {

                    if (finished) {
                        return;
                    }

                    const library =
                        getSupabaseLibrary();

                    if (library) {

                        finished = true;

                        try {

                            const client =
                                createSupabaseClient(
                                    library
                                );

                            resolve(client);

                        } catch (error) {

                            reject(error);
                        }

                    }
                }

                existingLoader.addEventListener(
                    "load",
                    checkLibrary,
                    {
                        once: true
                    }
                );

                existingLoader.addEventListener(
                    "error",
                    function () {

                        if (finished) {
                            return;
                        }

                        finished = true;

                        reject(
                            new Error(
                                "Unable to load Supabase CDN."
                            )
                        );

                    },
                    {
                        once: true
                    }
                );

                /*
                 * In case the loader finished before this
                 * listener was attached.
                 */

                setTimeout(
                    checkLibrary,
                    50
                );

            }
        );
    }

    /*
     * Load the CDN.
     */

    return new Promise(
        function (resolve, reject) {

            const script =
                document.createElement(
                    "script"
                );

            script.src =
                SUPABASE_CDN;

            script.async = false;

            script.dataset.mwanikiSupabaseLoader =
                "true";

            script.onload =
                function () {

                    /*
                     * Give the CDN a moment to expose
                     * its global.
                     */

                    const library =
                        getSupabaseLibrary();

                    if (!library) {

                        const error =
                            new Error(
                                "Supabase CDN loaded, but createClient() was not found."
                            );

                        console.error(
                            "❌",
                            error.message
                        );

                        console.error(
                            "Supabase globals:",
                            {
                                supabase:
                                    window.supabase,

                                supabaseJs:
                                    window.supabaseJs
                            }
                        );

                        window.mwanikiSupabaseError =
                            true;

                        reject(error);

                        return;
                    }

                    try {

                        const client =
                            createSupabaseClient(
                                library
                            );

                        resolve(client);

                    } catch (error) {

                        window.mwanikiSupabaseError =
                            true;

                        reject(error);
                    }
                };

            script.onerror =
                function () {

                    const error =
                        new Error(
                            "Unable to load Supabase CDN."
                        );

                    console.error(
                        "❌",
                        error.message
                    );

                    console.error(
                        "CDN:",
                        SUPABASE_CDN
                    );

                    window.mwanikiSupabaseError =
                        true;

                    reject(error);
                };

            document.head.appendChild(
                script
            );
        }
    );
}

/* ============================================================
   INITIALIZE
   ============================================================ */

if (
    window.mwanikiSupabaseReady === true &&
    window.supabaseClient
) {

    /*
     * Already initialized.
     */

    supabaseClient =
        window.supabaseClient;

    supabaseReadyPromise =
        Promise.resolve(
            supabaseClient
        );

} else {

    supabaseReadyPromise =
        loadSupabaseLibrary()
            .catch(
                function (error) {

                    console.error(
                        "❌ Mwaniki Scholars Supabase initialization failed:",
                        error
                    );

                    window.mwanikiSupabaseError =
                        true;

                    throw error;
                }
            );
}

/* ============================================================
   ES MODULE EXPORT
   ============================================================ */

export const supabase =
    await supabaseReadyPromise;

/* ============================================================
   EXPORT INITIALIZATION PROMISE
   ============================================================ */

export {
    supabaseReadyPromise
};

/* ============================================================
   DEFAULT EXPORT
   ============================================================ */

export default supabase;
