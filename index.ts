import { createClient } from "npm:@supabase/supabase-js@2";

// ============================================================
// MWANIKI SCHOLARS
// MWANIKI AI SEARCH ENGINE
// ============================================================
//
// Search order:
//
// 1. Mwaniki Scholars courses
// 2. Mwaniki Scholars units
// 3. Mwaniki Scholars notes
// 4. Mwaniki Scholars quizzes
// 5. Public-web layer
// 6. Visual-search layer
//
// This function does NOT use an AI/LLM provider.
//
// It is a retrieval/search engine.
// ============================================================


// ============================================================
// ENVIRONMENT
// ============================================================

const SUPABASE_URL =
    Deno.env.get("SUPABASE_URL");

const PUBLISHABLE_KEYS_RAW =
    Deno.env.get(
        "SUPABASE_PUBLISHABLE_KEYS"
    );

const SECRET_KEYS_RAW =
    Deno.env.get(
        "SUPABASE_SECRET_KEYS"
    );


if (!SUPABASE_URL) {
    throw new Error(
        "SUPABASE_URL is missing."
    );
}


// ============================================================
// GET SUPABASE KEYS
// ============================================================

function getDefaultKey(
    raw: string | undefined
): string | null {

    if (!raw) {
        return null;
    }

    try {

        const parsed =
            JSON.parse(raw);

        if (
            parsed &&
            typeof parsed === "object"
        ) {

            return (
                parsed.default ||
                null
            );

        }

    } catch {
        return null;
    }

    return null;
}


const publishableKey =
    getDefaultKey(
        PUBLISHABLE_KEYS_RAW
    );


const secretKey =
    getDefaultKey(
        SECRET_KEYS_RAW
    );


// ============================================================
// CORS
// ============================================================

const corsHeaders = {

    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",

    "Access-Control-Allow-Methods":
        "POST, OPTIONS"

};


// ============================================================
// CLIENTS
// ============================================================

const publicClient =
    publishableKey
        ? createClient(
            SUPABASE_URL,
            publishableKey
        )
        : null;


const adminClient =
    secretKey
        ? createClient(
            SUPABASE_URL,
            secretKey
        )
        : null;


// ============================================================
// RESPONSE HELPER
// ============================================================

function jsonResponse(
    body: unknown,
    status = 200
) {

    return new Response(
        JSON.stringify(body),
        {
            status,

            headers: {
                ...corsHeaders,

                "Content-Type":
                    "application/json"
            }
        }
    );

}


// ============================================================
// TEXT CLEANING
// ============================================================

function cleanText(
    value: unknown
): string {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    return String(value)
        .replace(/\s+/g, " ")
        .trim();

}


// ============================================================
// NORMALIZE SEARCH TEXT
// ============================================================

function normalizeText(
    value: unknown
): string {

    return cleanText(
        value
    )
        .toLowerCase()
        .replace(
            /[^\p{L}\p{N}\s]/gu,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}


// ============================================================
// SEARCH TERMS
// ============================================================

function buildSearchTerms(
    question: string
): string[] {

    const normalized =
        normalizeText(
            question
        );


    const words =
        normalized
            .split(/\s+/)
            .filter(
                word =>
                    word.length >= 2
            );


    const unique =
        Array.from(
            new Set(words)
        );


    return unique
        .slice(0, 12);

}


// ============================================================
// STOP WORDS
// ============================================================

const STOP_WORDS =
    new Set([
        "what",
        "what's",
        "whats",
        "how",
        "why",
        "when",
        "where",
        "which",
        "who",
        "are",
        "is",
        "the",
        "a",
        "an",
        "and",
        "or",
        "of",
        "to",
        "in",
        "on",
        "for",
        "with",
        "about",
        "explain",
        "describe",
        "tell",
        "me",
        "give",
        "some",
        "medical",
        "medicine",
        "topic",
        "information"
    ]);


// ============================================================
// IMPORTANT SEARCH TERMS
// ============================================================

function getMeaningfulTerms(
    question: string
): string[] {

    return buildSearchTerms(
        question
    ).filter(
        term =>
            !STOP_WORDS.has(term)
    );

}


// ============================================================
// SCORE SEARCH RESULT
// ============================================================

function scoreText(
    question: string,
    fields: string[]
): number {

    const questionText =
        normalizeText(
            question
        );


    const terms =
        getMeaningfulTerms(
            question
        );


    if (
        terms.length === 0
    ) {
        return 0;
    }


    const combined =
        normalizeText(
            fields.join(" ")
        );


    let score = 0;


    for (const term of terms) {

        if (
            combined.includes(
                term
            )
        ) {

            score += 1;

        }

    }


    if (
        combined.includes(
            questionText
        )
    ) {

        score += 5;

    }


    return score;

}


// ============================================================
// LIMIT / SHORTEN
// ============================================================

function shorten(
    value: unknown,
    maxLength = 500
): string {

    const text =
        cleanText(
            value
        );


    if (
        text.length <= maxLength
    ) {

        return text;

    }


    return (
        text.slice(
            0,
            maxLength - 3
        ) +
        "..."
    );

}


// ============================================================
// SEARCH COURSES
// ============================================================

async function searchCourses(
    client: any,
    question: string
) {

    const {
        data,
        error
    } =
        await client
            .from("courses")
            .select(
                "id,title,description,image,created_at"
            )
            .limit(100);


    if (error) {

        console.error(
            "Course search error:",
            error.message
        );

        return [];

    }


    return (data || [])
        .map(
            (course: any) => {

                const score =
                    scoreText(
                        question,
                        [
                            course.title,
                            course.description
                        ]
                    );


                return {
                    ...course,
                    _score: score
                };

            }
        )
        .filter(
            (course: any) =>
                course._score > 0
        )
        .sort(
            (a: any, b: any) =>
                b._score -
                a._score
        )
        .slice(0, 10);

}


// ============================================================
// SEARCH UNITS
// ============================================================

async function searchUnits(
    client: any,
    question: string
) {

    const {
        data,
        error
    } =
        await client
            .from("units")
            .select(
                "id,course_id,title,notes,image,created_at,video_url,notes_content"
            )
            .limit(500);


    if (error) {

        console.error(
            "Unit search error:",
            error.message
        );

        return [];

    }


    return (data || [])
        .map(
            (unit: any) => {

                const score =
                    scoreText(
                        question,
                        [
                            unit.title,
                            unit.notes,
                            unit.notes_content
                        ]
                    );


                return {
                    ...unit,
                    _score: score
                };

            }
        )
        .filter(
            (unit: any) =>
                unit._score > 0
        )
        .sort(
            (a: any, b: any) =>
                b._score -
                a._score
        )
        .slice(0, 20);

}


// ============================================================
// SEARCH NOTES
// ============================================================

async function searchNotes(
    client: any,
    question: string
) {

    const {
        data,
        error
    } =
        await client
            .from("notes")
            .select(
                "id,course,unit,file_name,file_url,created_at,course_id,unit_id,published"
            )
            .eq(
                "published",
                true
            )
            .limit(500);


    if (error) {

        console.error(
            "Notes search error:",
            error.message
        );

        return [];

    }


    return (data || [])
        .map(
            (note: any) => {

                const score =
                    scoreText(
                        question,
                        [
                            note.course,
                            note.unit,
                            note.file_name
                        ]
                    );


                return {
                    ...note,
                    _score: score
                };

            }
        )
        .filter(
            (note: any) =>
                note._score > 0
        )
        .sort(
            (a: any, b: any) =>
                b._score -
                a._score
        )
        .slice(0, 20);

}


// ============================================================
// SEARCH QUIZZES
// ============================================================

async function searchQuizzes(
    client: any,
    question: string
) {

    const {
        data,
        error
    } =
        await client
            .from("quizzes")
            .select(
                "id,course_id,question,option_a,option_b,option_c,option_d,correct_answer,created_at,course,unit"
            )
            .limit(500);


    if (error) {

        console.error(
            "Quiz search error:",
            error.message
        );

        return [];

    }


    return (data || [])
        .map(
            (quiz: any) => {

                const score =
                    scoreText(
                        question,
                        [
                            quiz.question,
                            quiz.course,
                            quiz.unit
                        ]
                    );


                return {
                    ...quiz,
                    _score: score
                };

            }
        )
        .filter(
            (quiz: any) =>
                quiz._score > 0
        )
        .sort(
            (a: any, b: any) =>
                b._score -
                a._score
        )
        .slice(0, 20);

}


// ============================================================
// BUILD MWANIKI SOURCES
// ============================================================

function buildMwanikiSources(
    courses: any[],
    units: any[],
    notes: any[],
    quizzes: any[]
) {

    const sources: any[] = [];


    for (const course of courses) {

        sources.push({

            type:
                "Course",

            source:
                "Mwaniki Scholars",

            title:
                cleanText(
                    course.title
                ),

            description:
                shorten(
                    course.description,
                    300
                ),

            course_id:
                course.id,

            url:
                `./course.html?course=${encodeURIComponent(course.id)}`

        });

    }


    for (const unit of units) {

        sources.push({

            type:
                "Unit",

            source:
                "Mwaniki Scholars",

            title:
                cleanText(
                    unit.title
                ),

            description:
                shorten(
                    unit.notes_content ||
                    unit.notes,
                    350
                ),

            course_id:
                unit.course_id,

            unit_id:
                unit.id,

            url:
                `./course.html?course=${encodeURIComponent(unit.course_id)}`

        });

    }


    for (const note of notes) {

        sources.push({

            type:
                "Notes",

            source:
                "Mwaniki Scholars",

            title:
                cleanText(
                    note.file_name ||
                    note.unit ||
                    note.course ||
                    "Study notes"
                ),

            description:
                `${cleanText(note.course)}${note.unit ? ` - ${cleanText(note.unit)}` : ""}`,

            course_id:
                note.course_id,

            unit_id:
                note.unit_id,

            url:
                note.file_url ||
                null

        });

    }


    for (const quiz of quizzes) {

        sources.push({

            type:
                "Quiz",

            source:
                "Mwaniki Scholars",

            title:
                shorten(
                    quiz.question,
                    250
                ),

            description:
                `${cleanText(quiz.course)}${quiz.unit ? ` - ${cleanText(quiz.unit)}` : ""}`,

            course_id:
                quiz.course_id,

            url:
                `./quiz.html?course=${encodeURIComponent(quiz.course_id)}&unit=${encodeURIComponent(quiz.unit || "")}`

        });

    }


    return sources;

}


// ============================================================
// BUILD SEARCH ANSWER
// ============================================================
//
// This is intentionally retrieval-based.
// No artificial AI-generated medical explanation is claimed.
// ============================================================

function buildSearchAnswer(
    question: string,
    courses: any[],
    units: any[],
    notes: any[],
    quizzes: any[]
): string {

    const sections: string[] = [];


    if (
        courses.length > 0
    ) {

        sections.push(
            `Mwaniki Scholars has ${courses.length} course result${courses.length === 1 ? "" : "s"} related to "${question}".`
        );

    }


    if (
        units.length > 0
    ) {

        const unitNames =
            units
                .slice(0, 5)
                .map(
                    unit =>
                        cleanText(
                            unit.title
                        )
                )
                .filter(Boolean);


        if (
            unitNames.length > 0
        ) {

            sections.push(
                `Related units include: ${unitNames.join(", ")}.`
            );

        }

    }


    if (
        notes.length > 0
    ) {

        sections.push(
            `${notes.length} published Mwaniki Scholars note result${notes.length === 1 ? "" : "s"} matched your search.`
        );

    }


    if (
        quizzes.length > 0
    ) {

        sections.push(
            `${quizzes.length} quiz result${quizzes.length === 1 ? "" : "s"} matched your search.`
        );

    }


    if (
        sections.length === 0
    ) {

        return (
            `No matching Mwaniki Scholars material was found for "${question}".`
        );

    }


    return sections.join(
        "\n\n"
    );

}


// ============================================================
// GOOGLE FALLBACK URL
// ============================================================
//
// This does NOT claim Google results were retrieved.
// It simply gives the student a direct public-web search
// when no server-side web provider is configured.
// ============================================================

function buildGoogleSearchURL(
    question: string
): string {

    return (
        "https://www.google.com/search?q=" +
        encodeURIComponent(
            question
        )
    );

}


// ============================================================
// GOOGLE IMAGE SEARCH FALLBACK
// ============================================================
//
// Same principle: this opens Google Images directly rather
// than pretending that the backend retrieved image results.
// ============================================================

function buildGoogleImageSearchURL(
    question: string
): string {

    return (
        "https://www.google.com/search?tbm=isch&q=" +
        encodeURIComponent(
            question
        )
    );

}


// ============================================================
// PUBLIC WEB SEARCH
// ============================================================
//
// The provider can be connected here later.
//
// We deliberately do not scrape Google from the Edge Function.
// ============================================================

async function searchWeb(
    question: string
): Promise<any[]> {

    const providerURL =
        Deno.env.get(
            "MWANIKI_WEB_SEARCH_URL"
        );


    const providerKey =
        Deno.env.get(
            "MWANIKI_WEB_SEARCH_KEY"
        );


    if (
        !providerURL ||
        !providerKey
    ) {

        return [];

    }


    try {

        const response =
            await fetch(
                providerURL,
                {
                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${providerKey}`

                    },

                    body:
                        JSON.stringify({
                            query:
                                question
                        })

                }
            );


        if (
            !response.ok
        ) {

            console.error(
                "Web search provider returned:",
                response.status
            );

            return [];

        }


        const data =
            await response.json();


        if (
            Array.isArray(
                data.results
            )
        ) {

            return data.results
                .slice(0, 10);

        }


        if (
            Array.isArray(
                data.webResults
            )
        ) {

            return data.webResults
                .slice(0, 10);

        }


        return [];

    } catch (error) {

        console.error(
            "Web search provider error:",
            error
        );

        return [];

    }

}


// ============================================================
// PUBLIC IMAGE SEARCH
// ============================================================

async function searchImages(
    question: string
): Promise<any[]> {

    const providerURL =
        Deno.env.get(
            "MWANIKI_IMAGE_SEARCH_URL"
        );


    const providerKey =
        Deno.env.get(
            "MWANIKI_IMAGE_SEARCH_KEY"
        );


    if (
        !providerURL ||
        !providerKey
    ) {

        return [];

    }


    try {

        const response =
            await fetch(
                providerURL,
                {
                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${providerKey}`

                    },

                    body:
                        JSON.stringify({
                            query:
                                question
                        })

                }
            );


        if (
            !response.ok
        ) {

            console.error(
                "Image search provider returned:",
                response.status
            );

            return [];

        }


        const data =
            await response.json();


        if (
            Array.isArray(
                data.images
            )
        ) {

            return data.images
                .slice(0, 12);

        }


        if (
            Array.isArray(
                data.results
            )
        ) {

            return data.results
                .slice(0, 12);

        }


        return [];

    } catch (error) {

        console.error(
            "Image search provider error:",
            error
        );

        return [];

    }

}


// ============================================================
// MAIN REQUEST HANDLER
// ============================================================

Deno.serve(
    async (
        request: Request
    ) => {

        // ----------------------------------------------------
        // CORS
        // ----------------------------------------------------

        if (
            request.method ===
            "OPTIONS"
        ) {

            return new Response(
                "ok",
                {
                    headers:
                        corsHeaders
                }
            );

        }


        // ----------------------------------------------------
        // METHOD
        // ----------------------------------------------------

        if (
            request.method !==
            "POST"
        ) {

            return jsonResponse(
                {
                    success:
                        false,

                    error:
                        "POST requests are required."
                },
                405
            );

        }


        // ----------------------------------------------------
        // SUPABASE CLIENT
        // ----------------------------------------------------

        const client =
            adminClient ||
            publicClient;


        if (!client) {

            return jsonResponse(
                {
                    success:
                        false,

                    error:
                        "Supabase server configuration is incomplete."
                },
                500
            );

        }


        // ----------------------------------------------------
        // READ REQUEST
        // ----------------------------------------------------

        let body: any;


        try {

            body =
                await request.json();

        } catch {

            return jsonResponse(
                {
                    success:
                        false,

                    error:
                        "Invalid JSON request."
                },
                400
            );

        }


        // ----------------------------------------------------
        // QUESTION
        // ----------------------------------------------------

        const question =
            cleanText(
                body?.question
            );


        if (!question) {

            return jsonResponse(
                {
                    success:
                        false,

                    error:
                        "A search question is required."
                },
                400
            );

        }


        if (
            question.length > 2000
        ) {

            return jsonResponse(
                {
                    success:
                        false,

                    error:
                        "The search question is too long."
                },
                400
            );

        }


        // ----------------------------------------------------
        // OPTIONS
        // ----------------------------------------------------

        const searchMwaniki =
            body?.searchMwaniki !== false;


        const searchWebEnabled =
            body?.searchWeb !== false;


        const searchImagesEnabled =
            body?.searchImages !== false;


        // ----------------------------------------------------
        // SEARCH MWANIKI
        // ----------------------------------------------------

        let courses: any[] = [];

        let units: any[] = [];

        let notes: any[] = [];

        let quizzes: any[] = [];


        if (
            searchMwaniki
        ) {

            [
                courses,
                units,
                notes,
                quizzes
            ] =
                await Promise.all([

                    searchCourses(
                        client,
                        question
                    ),

                    searchUnits(
                        client,
                        question
                    ),

                    searchNotes(
                        client,
                        question
                    ),

                    searchQuizzes(
                        client,
                        question
                    )

                ]);

        }


        // ----------------------------------------------------
        // BUILD MWANIKI SOURCES
        // ----------------------------------------------------

        const mwanikiSources =
            buildMwanikiSources(

                courses,

                units,

                notes,

                quizzes

            );


        // ----------------------------------------------------
        // WEB SEARCH
        // ----------------------------------------------------

        let webResults: any[] = [];


        if (
            searchWebEnabled
        ) {

            webResults =
                await searchWeb(
                    question
                );

        }


        // ----------------------------------------------------
        // IMAGE SEARCH
        // ----------------------------------------------------

        let images: any[] = [];


        if (
            searchImagesEnabled
        ) {

            images =
                await searchImages(
                    question
                );

        }


        // ----------------------------------------------------
        // ANSWER
        // ----------------------------------------------------

        const answer =
            buildSearchAnswer(

                question,

                courses,

                units,

                notes,

                quizzes

            );


        // ----------------------------------------------------
        // GOOGLE FALLBACK
        // ----------------------------------------------------

        const googleSearchUrl =
            searchWebEnabled &&
            webResults.length === 0
                ? buildGoogleSearchURL(
                    question
                )
                : null;


        const googleImageSearchUrl =
            searchImagesEnabled &&
            images.length === 0
                ? buildGoogleImageSearchURL(
                    question
                )
                : null;


        // ----------------------------------------------------
        // SEARCH STATUS
        // ----------------------------------------------------

        const webProviderConfigured =
            Boolean(
                Deno.env.get(
                    "MWANIKI_WEB_SEARCH_URL"
                ) &&
                Deno.env.get(
                    "MWANIKI_WEB_SEARCH_KEY"
                )
            );


        const imageProviderConfigured =
            Boolean(
                Deno.env.get(
                    "MWANIKI_IMAGE_SEARCH_URL"
                ) &&
                Deno.env.get(
                    "MWANIKI_IMAGE_SEARCH_KEY"
                )
            );


        // ----------------------------------------------------
        // FINAL RESPONSE
        // ----------------------------------------------------

        return jsonResponse({

            success:
                true,

            question,

            searchTerms:
                buildSearchTerms(
                    question
                ),

            answer,

            mwanikiSources,

            webResults,

            images,

            googleSearchUrl,

            googleImageSearchUrl,

            counts: {

                mwaniki:
                    mwanikiSources.length,

                courses:
                    courses.length,

                units:
                    units.length,

                notes:
                    notes.length,

                quizzes:
                    quizzes.length,

                web:
                    webResults.length,

                images:
                    images.length

            },

            searchStatus: {

                mwaniki:
                    `${mwanikiSources.length} Mwaniki result${mwanikiSources.length === 1 ? "" : "s"} found`,

                web:
                    webProviderConfigured
                        ? `${webResults.length} web result${webResults.length === 1 ? "" : "s"} found`
                        : "Public web provider not configured",

                images:
                    imageProviderConfigured
                        ? `${images.length} image result${images.length === 1 ? "" : "s"} found`
                        : "Public image provider not configured"

            }

        });

    }
);
