import { supabase } from "./supabase.js";

// ============================================================
// MWANIKI SCHOLARS
// PRIVATE AI MEDICAL TUTOR
// ============================================================

console.log("🤖 Mwaniki Scholars Private AI Tutor Loaded");


// ============================================================
// CONFIGURATION
// ============================================================

// IMPORTANT:
// Keep your existing AI API endpoint/key configuration here
// if your current tutor already has one.
//
// This tutor does NOT search Google or external websites.
// It first searches the Mwaniki Scholars knowledge base.


// ============================================================
// GET STUDENT
// ============================================================

async function getCurrentStudent() {

    const {
        data,
        error
    } = await supabase.auth.getSession();

    if (error) {

        console.error(
            "Session error:",
            error
        );

        return null;
    }

    if (!data.session) {

        console.warn(
            "No active student session."
        );

        return null;
    }

    return data.session.user;
}


// ============================================================
// SEARCH MWANIKI SCHOLARS KNOWLEDGE
// ============================================================

async function searchMwanikiKnowledge(
    question
) {

    console.log(
        "🔎 Searching Mwaniki Scholars knowledge..."
    );

    const {
        data,
        error
    } =
        await supabase.rpc(
            "search_ai_knowledge",
            {
                search_query:
                    question,

                match_limit:
                    8
            }
        );


    if (error) {

        console.error(
            "Knowledge search error:",
            error
        );

        throw error;
    }


    console.log(
        "📚 Knowledge results:",
        data
    );


    return data || [];
}


// ============================================================
// BUILD KNOWLEDGE CONTEXT
// ============================================================

function buildKnowledgeContext(
    results
) {

    if (
        !results ||
        results.length === 0
    ) {

        return `
No directly matching Mwaniki Scholars
material was found in the knowledge base.
        `.trim();
    }


    return results
        .map(
            (item, index) => {

                return `
SOURCE ${index + 1}

Type:
${item.source_type}

Title:
${item.title || "Untitled"}

Content:
${item.content}
                `.trim();

            }
        )
        .join("\n\n-------------------------\n\n");
}


// ============================================================
// AI QUESTION
// ============================================================

async function askAI() {

    const questionBox =
        document.getElementById(
            "aiQuestion"
        );


    const answerBox =
        document.getElementById(
            "aiAnswer"
        );


    if (!questionBox) {

        console.error(
            "❌ aiQuestion element not found."
        );

        return;
    }


    if (!answerBox) {

        console.error(
            "❌ aiAnswer element not found."
        );

        return;
    }


    const question =
        questionBox.value.trim();


    if (!question) {

        answerBox.innerHTML =
            "⚠️ Please enter a medical question.";

        return;
    }


    answerBox.innerHTML =
        "🔎 Searching Mwaniki Scholars materials...";


    try {

        // ----------------------------------------------------
        // CURRENT STUDENT
        // ----------------------------------------------------

        const user =
            await getCurrentStudent();


        if (!user) {

            answerBox.innerHTML =
                "❌ Please log in before using the AI Tutor.";

            return;
        }


        // ----------------------------------------------------
        // SEARCH LOCAL KNOWLEDGE
        // ----------------------------------------------------

        const results =
            await searchMwanikiKnowledge(
                question
            );


        // ----------------------------------------------------
        // BUILD CONTEXT
        // ----------------------------------------------------

        const knowledgeContext =
            buildKnowledgeContext(
                results
            );


        console.log(
            "📖 Context prepared for AI"
        );


        // ----------------------------------------------------
        // SHOW RETRIEVED MATERIAL
        // ----------------------------------------------------

        if (
            results.length === 0
        ) {

            answerBox.innerHTML = `
                <div>
                    <strong>
                        📚 No matching Mwaniki Scholars material found.
                    </strong>

                    <p>
                        This question is not currently covered
                        by the indexed Mwaniki Scholars materials.
                    </p>
                </div>
            `;

            return;
        }


        // ----------------------------------------------------
        // TEMPORARY LOCAL ANSWER
        // ----------------------------------------------------
        //
        // We deliberately stop here for this step.
        //
        // This proves that the tutor can retrieve your
        // private knowledge before we reconnect the external
        // AI generation layer.
        //

        answerBox.innerHTML = `

            <div
                style="
                    background:#f4f9ff;
                    border-left:5px solid #0b7285;
                    padding:18px;
                    border-radius:12px;
                "
            >

                <h3>
                    📚 Mwaniki Scholars Knowledge Found
                </h3>

                <p>
                    I found ${results.length}
                    relevant item(s) in the
                    Mwaniki Scholars knowledge base.
                </p>

                <details>

                    <summary>
                        View retrieved material
                    </summary>

                    <pre
                        style="
                            white-space:pre-wrap;
                            margin-top:15px;
                            font-family:inherit;
                        "
                    >${escapeHTML(
                        knowledgeContext
                    )}</pre>

                </details>

            </div>

        `;


    }

    catch (error) {

        console.error(
            "❌ Private AI Tutor error:",
            error
        );


        answerBox.innerHTML = `
            <div style="color:#b91c1c;">
                ❌ Unable to search the
                Mwaniki Scholars knowledge base.

                <br><br>

                ${escapeHTML(
                    error.message
                )}
            </div>
        `;

    }

}


// ============================================================
// HTML SAFETY
// ============================================================

function escapeHTML(
    text
) {

    return String(text)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// ============================================================
// GLOBAL FUNCTION
// ============================================================
//
// Your existing dashboard uses:
// onclick="askAI()"
//
// Therefore expose the function globally.

window.askAI =
    askAI;


console.log(
    "✅ Private Mwaniki AI search ready"
);
