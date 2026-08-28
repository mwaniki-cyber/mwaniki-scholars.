```javascript
import { supabase } from "./supabase.js";

// ============================================================
// MWANIKI SCHOLARS — PRIVATE AI TUTOR
// Knowledge source:
// 1. knowledge_base table
// 2. Supabase notes/quiz material already imported there
// ============================================================

console.log("🤖 Mwaniki Scholars Private AI Tutor Loaded");

const questionBox = document.getElementById("aiQuestion");
const answerBox = document.getElementById("aiAnswer");
const askButton = document.getElementById("askAIButton");

console.log("AI elements:", {
    questionBox: !!questionBox,
    answerBox: !!answerBox,
    askButton: !!askButton
});


// ============================================================
// BUTTON
// ============================================================

if (askButton) {

    askButton.addEventListener("click", askAI);

    console.log("✅ AI Tutor button connected");

} else {

    console.error(
        "❌ askAIButton not found"
    );

}


// ============================================================
// ASK AI
// ============================================================

async function askAI() {

    console.log("🤖 ASK AI BUTTON CLICKED");

    if (!questionBox || !answerBox) {

        console.error(
            "❌ AI interface elements missing"
        );

        return;
    }


    const question =
        questionBox.value.trim();


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


    if (askButton) {

        askButton.disabled = true;

        askButton.textContent =
            "⏳ Searching Mwaniki Scholars...";

    }


    answerBox.innerHTML = `
        <div class="ai-response">

            <h3>
                🤖 Mwaniki Scholars Tutor
            </h3>

            <p>
                🔎 Searching your Mwaniki Scholars
                notes and quizzes...
            </p>

        </div>
    `;


    try {

        // ====================================================
        // LOAD KNOWLEDGE BASE
        // ====================================================

        console.log(
            "📚 Searching knowledge_base..."
        );


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

            showError(
                "Unable to access the Mwaniki Scholars knowledge base.",
                error.message
            );

            return;
        }


        console.log(
            "📚 Knowledge records:",
            data?.length || 0
        );


        if (!data || data.length === 0) {

            answerBox.innerHTML = `
                <div class="ai-response">

                    <h3>
                        📚 Knowledge Base Empty
                    </h3>

                    <p>
                        No notes or quiz material is currently
                        available to the private tutor.
                    </p>

                </div>
            `;

            return;
        }


        // ====================================================
        // SEARCH
        // ====================================================

        const matches =
            findRelevantMaterial(
                question,
                data
            );


        console.log(
            "🔎 Matching material:",
            matches
        );


        if (matches.length === 0) {

            answerBox.innerHTML = `
                <div class="ai-response">

                    <h3>
                        🤖 Mwaniki Scholars Tutor
                    </h3>

                    <p>
                        I could not find enough information
                        in the Mwaniki Scholars notes and
                        quizzes to answer that question.
                    </p>

                    <p>
                        Try asking with the exact medical
                        topic, structure, condition,
                        investigation, drug, or concept.
                    </p>

                </div>
            `;

            return;
        }


        // ====================================================
        // DISPLAY ANSWER FROM WEBSITE KNOWLEDGE
        // ====================================================

        answerBox.innerHTML =
            generateResponse(
                question,
                matches
            );


        console.log(
            "✅ Private tutor response generated"
        );

    }

    catch (error) {

        console.error(
            "❌ AI Tutor error:",
            error
        );

        showError(
            "Something went wrong while searching the study material.",
            error.message
        );

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
// SEARCH KNOWLEDGE
// ============================================================

function findRelevantMaterial(
    question,
    records
) {

    const questionWords =
        tokenize(question);


    if (
        questionWords.length === 0
    ) {

        return [];

    }


    const scored =
        records.map(record => {

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
                ).toLowerCase();


            const titleLower =
                title.toLowerCase();


            let score = 0;


            questionWords.forEach(word => {

                // Exact word match
                const words =
                    tokenize(combined);


                if (
                    words.includes(word)
                ) {

                    score += 5;

                }


                // Phrase/substring match
                if (
                    combined.includes(word)
                ) {

                    score += 2;

                }


                // Title match
                if (
                    titleLower.includes(word)
                ) {

                    score += 8;

                }

            });


            // =================================================
            // BONUS FOR QUIZ QUESTIONS
            // =================================================

            if (
                record.source_type === "quiz"
            ) {

                score += 1;

            }


            return {
                record,
                score
            };

        });


    scored.sort(
        (a, b) =>
            b.score - a.score
    );


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

        <div
            class="ai-response"
            style="
                background:#f8fbfd;
                padding:20px;
                border-radius:15px;
                margin-top:15px;
            "
        >

            <h3>
                🤖 Mwaniki Scholars Tutor
            </h3>

            <p>

                <strong>
                    Question:
                </strong>

                ${escapeHTML(question)}

            </p>

            <hr>

            <p>
                📚 Information found in
                Mwaniki Scholars study material:
            </p>

    `;


    matches.forEach(item => {

        const source =
            item.source_type === "quiz"
                ? "📝 Quiz"
                : "📄 Note";


        html += `

            <div
                style="
                    background:white;
                    border-left:5px solid #0b7285;
                    padding:15px;
                    margin:12px 0;
                    border-radius:10px;
                "
            >

                <div>

                    <strong>
                        ${source}
                    </strong>

                </div>


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

    });


    html += `

            <div
                style="
                    margin-top:18px;
                    padding:12px;
                    background:#eef7fb;
                    border-radius:10px;
                    color:#526779;
                    font-size:13px;
                "
            >

                🔒 This answer is based only on
                Mwaniki Scholars' private
                knowledge base.

            </div>

        </div>

    `;


    return html;

}


// ============================================================
// FORMAT CONTENT
// ============================================================

function formatContent(content) {

    return escapeHTML(
        content
    ).replace(
        /\n/g,
        "<br>"
    );

}


// ============================================================
// ERROR DISPLAY
// ============================================================

function showError(
    message,
    details
) {

    if (!answerBox) {
        return;
    }


    answerBox.innerHTML = `

        <div
            class="ai-response"
            style="
                background:#fff5f5;
                border-left:5px solid #dc2626;
                padding:20px;
                border-radius:12px;
            "
        >

            <h3>
                🤖 Mwaniki Scholars Tutor
            </h3>

            <p>
                ❌ ${escapeHTML(message)}
            </p>

            <p
                style="
                    font-size:13px;
                    color:#666;
                "
            >
                ${escapeHTML(
                    details || ""
                )}
            </p>

        </div>

    `;

}


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHTML(value) {

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
// GLOBAL ACCESS
// ============================================================

window.askAI =
    askAI;


console.log(
    "✅ Mwaniki Scholars Private AI Tutor Ready"
);
```
