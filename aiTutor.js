import { supabase } from "./supabase.js";


// ============================================================
// MWANIKI SCHOLARS
// PRIVATE AI MEDICAL TUTOR
// ============================================================

console.log(
    "🤖 Mwaniki Scholars Private AI Tutor Loaded"
);


// ============================================================
// ELEMENTS
// ============================================================

const questionBox =
    document.getElementById(
        "aiQuestion"
    );


const answerBox =
    document.getElementById(
        "aiAnswer"
    );


const askButton =
    document.getElementById(
        "askAIButton"
    );


// ============================================================
// CHECK ELEMENTS
// ============================================================

if (!questionBox) {

    console.error(
        "❌ aiQuestion element not found"
    );

}


if (!answerBox) {

    console.error(
        "❌ aiAnswer element not found"
    );

}


if (!askButton) {

    console.error(
        "❌ askAIButton element not found"
    );

}


// ============================================================
// BUTTON EVENT
// ============================================================

if (askButton) {

    askButton.addEventListener(
        "click",
        askAI
    );

}


// ============================================================
// ASK AI
// ============================================================

async function askAI() {

    console.log(
        "🤖 Ask AI Tutor clicked"
    );


    if (!questionBox) {

        return;

    }


    if (!answerBox) {

        return;

    }


    const question =
        questionBox.value
            .trim();


    // ========================================================
    // EMPTY QUESTION
    // ========================================================

    if (!question) {

        answerBox.innerHTML = `

            <div class="ai-response">

                <h3>
                    🤖 Mwaniki Scholars Tutor
                </h3>

                <p>
                    ⚠️ Please enter a medical question.
                </p>

            </div>

        `;

        questionBox.focus();

        return;

    }


    // ========================================================
    // BUTTON STATE
    // ========================================================

    if (askButton) {

        askButton.disabled = true;

        askButton.textContent =
            "⏳ Searching study material...";

    }


    answerBox.innerHTML = `

        <div class="ai-response">

            <h3>
                🤖 Mwaniki Scholars Tutor
            </h3>

            <p>
                🔎 Searching notes and quiz material...
            </p>

        </div>

    `;


    try {


        // ====================================================
        // GET KNOWLEDGE
        // ====================================================

        const {
            data,
            error
        } =
            await supabase
                .from("knowledge_base")
                .select(
                    "id, source_type, course_id, unit_id, title, content"
                )
                .limit(1000);


        if (error) {

            console.error(
                "❌ Knowledge base error:",
                error
            );


            answerBox.innerHTML = `

                <div class="ai-response">

                    <h3>
                        🤖 Mwaniki Scholars Tutor
                    </h3>

                    <p>
                        ❌ Unable to access the Mwaniki
                        Scholars knowledge base.
                    </p>

                    <p>
                        ${escapeHTML(
                            error.message
                        )}
                    </p>

                </div>

            `;

            return;

        }


        // ====================================================
        // NO DATA
        // ====================================================

        if (
            !data ||
            data.length === 0
        ) {

            answerBox.innerHTML = `

                <div class="ai-response">

                    <h3>
                        📚 Knowledge Base Empty
                    </h3>

                    <p>
                        There are currently no notes or
                        quiz questions available to the
                        private tutor.
                    </p>

                </div>

            `;

            return;

        }


        console.log(
            `📚 Knowledge records found: ${data.length}`
        );


        // ====================================================
        // SEARCH
        // ====================================================

        const matches =
            findRelevantMaterial(
                question,
                data
            );


        console.log(
            "🔎 Relevant material:",
            matches
        );


        // ====================================================
        // NO MATCH
        // ====================================================

        if (
            matches.length === 0
        ) {

            answerBox.innerHTML = `

                <div class="ai-response">

                    <h3>
                        🤖 Mwaniki Scholars Tutor
                    </h3>

                    <p>
                        📚 I could not find enough
                        information about that question
                        in the Mwaniki Scholars notes and
                        quizzes.
                    </p>

                    <p>
                        Try using the name of the medical
                        topic, condition, structure,
                        drug, investigation, or concept.
                    </p>

                </div>

            `;

            return;

        }


        // ====================================================
        // GENERATE RESPONSE
        // ====================================================

        const response =
            generateResponse(
                question,
                matches
            );


        answerBox.innerHTML =
            response;


        console.log(
            "✅ Private tutor response generated"
        );


    }

    catch (error) {

        console.error(
            "❌ AI Tutor error:",
            error
        );


        answerBox.innerHTML = `

            <div class="ai-response">

                <h3>
                    🤖 Mwaniki Scholars Tutor
                </h3>

                <p>
                    ❌ Something went wrong while
                    searching the study material.
                </p>

                <p>
                    ${escapeHTML(
                        error.message ||
                        "Unknown error"
                    )}
                </p>

            </div>

        `;

    }

    finally {

        if (askButton) {

            askButton.disabled = false;

            askButton.textContent =
                "🤖 Ask AI Tutor";

        }

    }

}


// ============================================================
// FIND RELEVANT MATERIAL
// ============================================================

function findRelevantMaterial(
    question,
    records
) {


    // --------------------------------------------------------
    // NORMALIZE QUESTION
    // --------------------------------------------------------

    const questionWords =
        tokenize(question);


    if (
        questionWords.length === 0
    ) {

        return [];

    }


    // --------------------------------------------------------
    // SCORE RECORDS
    // --------------------------------------------------------

    const scored =
        records.map(
            record => {

                const title =
                    String(
                        record.title || ""
                    );


                const content =
                    String(
                        record.content || ""
                    );


                const combined =
                    (
                        title +
                        " " +
                        content
                    )
                    .toLowerCase();


                const words =
                    tokenize(
                        combined
                    );


                let score = 0;


                questionWords.forEach(
                    word => {

                        if (
                            words.includes(
                                word
                            )
                        ) {

                            score += 3;

                        }


                        if (
                            combined.includes(
                                word
                            )
                        ) {

                            score += 1;

                        }

                    }
                );


                // ------------------------------------------------
                // TITLE MATCHES ARE MORE IMPORTANT
                // ------------------------------------------------

                const titleLower =
                    title.toLowerCase();


                questionWords.forEach(
                    word => {

                        if (
                            titleLower.includes(
                                word
                            )
                        ) {

                            score += 5;

                        }

                    }
                );


                return {

                    record,

                    score

                };

            }
        );


    // --------------------------------------------------------
    // SORT
    // --------------------------------------------------------

    scored.sort(
        (a, b) =>
            b.score - a.score
    );


    // --------------------------------------------------------
    // ONLY RELEVANT RESULTS
    // --------------------------------------------------------

    return scored
        .filter(
            item =>
                item.score > 0
        )
        .slice(
            0,
            8
        )
        .map(
            item =>
                item.record
        );

}


// ============================================================
// TOKENIZER
// ============================================================

function tokenize(text) {

    return String(text)
        .toLowerCase()
        .replace(
            /[^a-z0-9\s]/g,
            " "
        )
        .split(
            /\s+/
        )
        .filter(
            word =>
                word.length >= 3
        );

}


// ============================================================
// GENERATE RESPONSE
// ============================================================

function generateResponse(
    question,
    matches
) {


    let html = `

        <div class="ai-response">

            <h3>
                🤖 Mwaniki Scholars Tutor
            </h3>

            <p>

                <strong>Question:</strong>
                ${escapeHTML(question)}

            </p>

            <p>
                📚 I found relevant Mwaniki Scholars
                study material:
            </p>

    `;


    matches.forEach(
        (item, index) => {


            const source =
                item.source_type === "quiz"

                    ? "📝 Quiz"

                    : "📄 Note";


            html += `

                <div class="source-result">

                    <strong>
                        ${source}
                    </strong>


                    <h4>
                        ${escapeHTML(
                            item.title ||
                            "Study Material"
                        )}
                    </h4>


                    <div>

                        ${formatContent(
                            item.content ||
                            ""
                        )}

                    </div>

                </div>

            `;

        }
    );


    html += `

            <div
                style="
                    margin-top:18px;
                    padding:12px;
                    background:#eef7fb;
                    border-radius:10px;
                    font-size:13px;
                    color:#526779;
                "
            >

                🔒 This response is based on
                Mwaniki Scholars knowledge-base
                material.

            </div>

        </div>

    `;


    return html;

}


// ============================================================
// FORMAT CONTENT
// ============================================================

function formatContent(
    content
) {

    return escapeHTML(
        content
    )
    .replace(
        /\n/g,
        "<br>"
    );

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(
    value
) {

    return String(value)
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

window.askAI =
    askAI;


console.log(
    "✅ askAI() available"
);
