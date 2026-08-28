import { supabase } from "./supabase.js";

// ============================================================
// MWANIKI SCHOLARS — PRIVATE AI TUTOR
// Answers using Mwaniki Scholars notes + quiz content
// ============================================================

console.log("🤖 Mwaniki Scholars Private AI Tutor Loaded");


// ============================================================
// FIND ELEMENTS
// ============================================================

const questionBox =
    document.getElementById("aiQuestion");

const answerBox =
    document.getElementById("aiAnswer");


// ============================================================
// ASK AI
// ============================================================

async function askAI() {

    console.log("🤖 Ask AI Tutor clicked");


    if (!questionBox) {

        console.error(
            "❌ aiQuestion element not found"
        );

        return;

    }


    if (!answerBox) {

        console.error(
            "❌ aiAnswer element not found"
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
        "⏳ Searching Mwaniki Scholars notes and quizzes...";


    try {


        // ====================================================
        // SEARCH KNOWLEDGE BASE
        // ====================================================

        const {
            data,
            error
        } =
            await supabase
                .from("knowledge_base")
                .select(
                    "source_type, course_id, unit_id, title, content"
                )
                .limit(1000);


        if (error) {

            console.error(
                "❌ Knowledge base error:",
                error
            );

            answerBox.innerHTML =
                "❌ Unable to access Mwaniki Scholars study material.";

            return;

        }


        if (!data || data.length === 0) {

            answerBox.innerHTML =
                `
                <div>
                    <strong>📚 No study material found.</strong>
                    <p>
                        The Mwaniki Scholars knowledge base does not
                        contain notes or quiz material yet.
                    </p>
                </div>
                `;

            return;

        }


        // ====================================================
        // FIND RELEVANT MATERIAL
        // ====================================================

        const words =
            question
                .toLowerCase()
                .split(/\s+/)
                .filter(word =>
                    word.length > 2
                );


        const matches =
            data
                .map(item => {

                    const text =
                        (
                            (item.title || "") +
                            " " +
                            (item.content || "")
                        )
                        .toLowerCase();


                    let score = 0;


                    words.forEach(word => {

                        if (
                            text.includes(word)
                        ) {

                            score++;

                        }

                    });


                    return {
                        ...item,
                        score
                    };

                })
                .filter(item =>
                    item.score > 0
                )
                .sort(
                    (a, b) =>
                        b.score - a.score
                )
                .slice(0, 8);


        // ====================================================
        // NOTHING RELEVANT
        // ====================================================

        if (matches.length === 0) {

            answerBox.innerHTML =
                `
                <div>
                    <strong>📚 I couldn't find that in Mwaniki Scholars.</strong>

                    <p>
                        I can answer questions using the notes and
                        quiz material currently available in the
                        Mwaniki Scholars knowledge base.
                    </p>
                </div>
                `;

            return;

        }


        // ====================================================
        // BUILD ANSWER FROM STORED MATERIAL
        // ====================================================

        const answer =
            buildAnswer(
                question,
                matches
            );


        answerBox.innerHTML =
            answer;


        console.log(
            "✅ Answer generated from Mwaniki Scholars knowledge base"
        );


    }

    catch (error) {

        console.error(
            "❌ AI Tutor error:",
            error
        );


        answerBox.innerHTML =
            "❌ The AI Tutor encountered an error while searching the study material.";

    }

}


// ============================================================
// BUILD ANSWER
// ============================================================

function buildAnswer(
    question,
    matches
) {

    let html = "";


    html +=
        `
        <div class="ai-response">

            <h3>
                🤖 Mwaniki Scholars Tutor
            </h3>

            <p>
                <strong>Question:</strong>
                ${escapeHTML(question)}
            </p>
        `;


    matches.forEach(
        (item, index) => {

            html +=
                `
                <div
                    style="
                        margin-top:15px;
                        padding:15px;
                        background:#f4f9ff;
                        border-radius:12px;
                        border-left:4px solid #0b7285;
                    "
                >

                    <strong>
                        📚 ${escapeHTML(
                            item.title ||
                            "Study Material"
                        )}
                    </strong>

                    <p>
                        ${formatContent(
                            item.content || ""
                        )}
                    </p>

                </div>
                `;

        }
    );


    html +=
        `
        <p
            style="
                margin-top:18px;
                font-size:13px;
                color:#64748b;
            "
        >
            📖 Answer generated from Mwaniki Scholars
            notes and quiz material.
        </p>

        </div>
        `;


    return html;

}


// ============================================================
// FORMAT CONTENT
// ============================================================

function formatContent(content) {

    return escapeHTML(content)
        .replace(/\n/g, "<br>");

}


// ============================================================
// HTML SECURITY
// ============================================================

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ============================================================
// MAKE ASKAI AVAILABLE TO DASHBOARD HTML
// ============================================================

window.askAI =
    askAI;


console.log(
    "✅ askAI() is available globally"
);
