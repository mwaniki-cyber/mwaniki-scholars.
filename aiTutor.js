```javascript
import { supabase } from "./supabase.js";

// ============================================================
// MWANIKI SCHOLARS — PRIVATE AI TUTOR
// ============================================================
// Searches:
//   1. ai_knowledge
//   2. notes
//   3. quiz_questions
//   4. quizzes
//   5. courses
//   6. units
//
// IMPORTANT:
// This version DOES NOT use public.knowledge_base.
// It works with the tables that actually exist in Mwaniki Scholars.
// ============================================================

console.log("🤖 Mwaniki Scholars Private AI Tutor Loaded");

// ============================================================
// CONFIGURATION
// ============================================================

const TABLES = [
    "ai_knowledge",
    "notes",
    "quiz_questions",
    "quizzes",
    "courses",
    "units"
];

const MAX_RESULTS_PER_TABLE = 20;
const MAX_CONTEXT_LENGTH = 12000;


// ============================================================
// UTILITY — SAFE TEXT
// ============================================================

function cleanText(value) {

    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "object") {

        try {
            return JSON.stringify(value);
        } catch {
            return "";
        }
    }

    return String(value);
}


// ============================================================
// GET ALL TEXT FROM A DATABASE ROW
// ============================================================

function rowToText(row) {

    if (!row || typeof row !== "object") {
        return "";
    }

    const parts = [];

    Object.entries(row).forEach(([key, value]) => {

        if (
            value === null ||
            value === undefined ||
            key === "id" ||
            key === "created_at" ||
            key === "updated_at"
        ) {
            return;
        }

        const text = cleanText(value).trim();

        if (!text) {
            return;
        }

        parts.push(
            `${key}: ${text}`
        );

    });

    return parts.join(" | ");
}


// ============================================================
// NORMALIZE SEARCH TEXT
// ============================================================

function normalize(text) {

    return cleanText(text)
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


// ============================================================
// REMOVE COMMON WORDS
// ============================================================

function getKeywords(question) {

    const stopWords = new Set([

        "what",
        "when",
        "where",
        "which",
        "who",
        "why",
        "how",
        "does",
        "do",
        "is",
        "are",
        "the",
        "a",
        "an",
        "of",
        "to",
        "in",
        "on",
        "for",
        "with",
        "and",
        "or",
        "from",
        "about",
        "explain",
        "tell",
        "me",
        "please",
        "can",
        "you",
        "could",
        "would",
        "be",
        "this",
        "that"
    ]);

    return normalize(question)
        .split(" ")
        .filter(word =>
            word.length >= 3 &&
            !stopWords.has(word)
        );

}


// ============================================================
// SCORE A DATABASE ROW
// ============================================================

function scoreRow(row, question) {

    const text =
        normalize(
            rowToText(row)
        );

    if (!text) {
        return 0;
    }

    const keywords =
        getKeywords(question);

    if (keywords.length === 0) {
        return 0;
    }

    let score = 0;

    keywords.forEach(keyword => {

        if (text.includes(keyword)) {
            score++;
        }

    });

    // Exact phrase gets a strong bonus
    const normalizedQuestion =
        normalize(question);

    if (
        normalizedQuestion.length > 5 &&
        text.includes(normalizedQuestion)
    ) {
        score += 5;
    }

    return score;
}


// ============================================================
// FETCH TABLE
// ============================================================

async function fetchTable(tableName) {

    try {

        const result =
            await supabase
                .from(tableName)
                .select("*")
                .limit(MAX_RESULTS_PER_TABLE);

        if (result.error) {

            console.warn(
                `⚠️ Could not read ${tableName}:`,
                result.error.message
            );

            return [];
        }

        return result.data || [];

    } catch (error) {

        console.warn(
            `⚠️ Exception reading ${tableName}:`,
            error
        );

        return [];
    }
}


// ============================================================
// SEARCH THE MWANIKI SCHOLARS DATABASE
// ============================================================

async function searchPrivateKnowledge(question) {

    console.log(
        "🔎 Searching Mwaniki Scholars knowledge..."
    );

    const allResults = [];

    for (const tableName of TABLES) {

        const rows =
            await fetchTable(tableName);

        console.log(
            `📚 ${tableName}: ${rows.length} rows`
        );

        rows.forEach(row => {

            const score =
                scoreRow(
                    row,
                    question
                );

            if (score > 0) {

                allResults.push({

                    table: tableName,

                    score,

                    row,

                    text:
                        rowToText(row)

                });

            }

        });

    }

    allResults.sort(
        (a, b) =>
            b.score - a.score
    );

    const results =
        allResults.slice(
            0,
            10
        );

    console.log(
        "🔎 Relevant knowledge:",
        results
    );

    return results;
}


// ============================================================
// BUILD ANSWER FROM DATABASE MATERIAL
// ============================================================

function buildPrivateAnswer(
    question,
    results
) {

    if (
        !results ||
        results.length === 0
    ) {

        return {
            found: false,

            answer:
                `I could not find enough information about "${question}" in the Mwaniki Scholars knowledge base yet.

Please try using a more specific medical term, course name, unit name, or topic that appears in the Mwaniki Scholars notes or quizzes.`
        };

    }


    let context = "";

    results.forEach(
        (item, index) => {

            const source =
                item.table;

            const text =
                item.text;

            context +=
                `SOURCE ${index + 1} — ${source}\n` +
                `${text}\n\n`;

        }
    );


    if (
        context.length >
        MAX_CONTEXT_LENGTH
    ) {

        context =
            context.substring(
                0,
                MAX_CONTEXT_LENGTH
            );

    }


    // --------------------------------------------------------
    // Extract useful content from matching records
    // --------------------------------------------------------

    const answerParts = [];


    results.forEach(item => {

        const row =
            item.row;

        const text =
            rowToText(row);


        if (!text) {
            return;
        }


        // Quiz question
        if (
            item.table ===
            "quiz_questions"
        ) {

            const questionText =
                row.question ||
                row.question_text ||
                row.content ||
                "";

            const correctAnswer =
                row.correct_answer ||
                row.answer ||
                row.correctAnswer ||
                "";

            if (
                questionText ||
                correctAnswer
            ) {

                answerParts.push({

                    type: "quiz",

                    text:
                        `${cleanText(
                            questionText
                        )}` +
                        (
                            correctAnswer
                                ? `\nAnswer: ${cleanText(
                                    correctAnswer
                                )}`
                                : ""
                        )

                });

            }

            return;
        }


        // AI knowledge
        if (
            item.table ===
            "ai_knowledge"
        ) {

            answerParts.push({

                type: "knowledge",

                text

            });

            return;
        }


        // Notes
        if (
            item.table ===
            "notes"
        ) {

            answerParts.push({

                type: "notes",

                text

            });

            return;
        }


        // Courses
        if (
            item.table ===
            "courses"
        ) {

            answerParts.push({

                type: "course",

                text

            });

            return;
        }


        // Units
        if (
            item.table ===
            "units"
        ) {

            answerParts.push({

                type: "unit",

                text

            });

            return;
        }


        // Quizzes
        if (
            item.table ===
            "quizzes"
        ) {

            answerParts.push({

                type: "quiz",

                text

            });

        }

    });


    // --------------------------------------------------------
    // Remove duplicate content
    // --------------------------------------------------------

    const uniqueAnswers = [];

    const seen = new Set();

    answerParts.forEach(item => {

        const key =
            normalize(item.text);

        if (
            !key ||
            seen.has(key)
        ) {
            return;
        }

        seen.add(key);

        uniqueAnswers.push(item);

    });


    // --------------------------------------------------------
    // Create readable response
    // --------------------------------------------------------

    let answer =
        "📚 Mwaniki Scholars Knowledge Base\n\n";


    answer +=
        `I found ${uniqueAnswers.length} relevant source ` +
        `${uniqueAnswers.length === 1 ? "record" : "records"} ` +
        `for your question.\n\n`;


    uniqueAnswers
        .slice(0, 6)
        .forEach((item, index) => {

            let label =
                "📖 Source";

            if (
                item.type ===
                "quiz"
            ) {
                label =
                    "📝 Quiz";
            }

            if (
                item.type ===
                "notes"
            ) {
                label =
                    "📄 Notes";
            }

            if (
                item.type ===
                "knowledge"
            ) {
                label =
                    "🧠 Knowledge Base";
            }

            if (
                item.type ===
                "course"
            ) {
                label =
                    "📚 Course";
            }

            if (
                item.type ===
                "unit"
            ) {
                label =
                    "📘 Unit";
            }


            answer +=
                `${label} ${index + 1}\n`;


            answer +=
                item.text;


            answer +=
                "\n\n";

        });


    answer +=
        "────────────────────\n";


    answer +=
        "🔐 This response was retrieved from " +
        "Mwaniki Scholars' private course, note, " +
        "unit, quiz, and knowledge-base content.";


    return {

        found: true,

        answer,

        context

    };

}


// ============================================================
// DISPLAY ANSWER
// ============================================================

function displayAIAnswer(
    text
) {

    const answerBox =
        document.getElementById(
            "aiAnswer"
        );


    if (!answerBox) {

        console.error(
            "❌ aiAnswer element not found."
        );

        alert(
            "AI Tutor display area is missing from the dashboard."
        );

        return;
    }


    answerBox.innerHTML = "";


    const box =
        document.createElement(
            "div"
        );


    box.style.cssText = `
        margin-top:15px;
        padding:18px;
        border-radius:14px;
        background:#f1f8fb;
        border-left:5px solid #0b7285;
        color:#183b56;
        line-height:1.7;
        white-space:pre-wrap;
    `;


    box.textContent =
        text;


    answerBox.appendChild(
        box
    );

}


// ============================================================
// FIND QUESTION INPUT
// ============================================================

function getAIQuestionInput() {

    const possibleIds = [

        "aiQuestion",

        "aiInput",

        "question",

        "studentQuestion",

        "tutorQuestion",

        "aiTutorQuestion"

    ];


    for (
        const id of possibleIds
    ) {

        const element =
            document.getElementById(id);

        if (element) {
            return element;
        }

    }


    // Search textareas as fallback

    const textareas =
        document.querySelectorAll(
            "textarea"
        );


    for (
        const textarea of textareas
    ) {

        const placeholder =
            (
                textarea.placeholder ||
                ""
            ).toLowerCase();


        if (
            placeholder.includes(
                "medical"
            ) ||
            placeholder.includes(
                "question"
            ) ||
            placeholder.includes(
                "ask"
            ) ||
            placeholder.includes(
                "tutor"
            )
        ) {

            return textarea;

        }

    }


    return null;

}


// ============================================================
// MAIN ASK AI FUNCTION
// ============================================================

async function askAI() {

    console.log(
        "🤖 askAI() started"
    );


    const button =
        document.querySelector(
            '[onclick="askAI()"]'
        );


    const questionInput =
        getAIQuestionInput();


    // --------------------------------------------------------
    // INPUT CHECK
    // --------------------------------------------------------

    if (!questionInput) {

        console.error(
            "❌ AI question input not found."
        );


        displayAIAnswer(
            "⚠️ The AI Tutor question box could not be found. Please check that the textarea has an ID such as aiQuestion."
        );

        return;

    }


    const question =
        questionInput.value.trim();


    if (!question) {

        displayAIAnswer(
            "✏️ Please type a medical question first."
        );

        questionInput.focus();

        return;

    }


    // --------------------------------------------------------
    // BUTTON LOADING STATE
    // --------------------------------------------------------

    let originalText = "";

    if (button) {

        originalText =
            button.innerText;

        button.disabled =
            true;

        button.style.opacity =
            "0.7";

        button.style.cursor =
            "wait";

        button.innerText =
            "🔎 Searching Mwaniki Scholars...";

    }


    displayAIAnswer(
        "🔎 Searching Mwaniki Scholars notes, quizzes and knowledge..."
    );


    try {

        // ----------------------------------------------------
        // SEARCH PRIVATE DATABASE
        // ----------------------------------------------------

        const results =
            await searchPrivateKnowledge(
                question
            );


        // ----------------------------------------------------
        // BUILD RESPONSE
        // ----------------------------------------------------

        const response =
            buildPrivateAnswer(
                question,
                results
            );


        // ----------------------------------------------------
        // DISPLAY
        // ----------------------------------------------------

        displayAIAnswer(
            response.answer
        );


        console.log(
            "✅ AI Tutor response generated"
        );


    } catch (error) {

        console.error(
            "❌ AI Tutor error:",
            error
        );


        displayAIAnswer(
            "⚠️ The Mwaniki Scholars AI Tutor encountered an error while searching the private knowledge base.\n\nError: " +
            cleanText(
                error.message
            )
        );


    } finally {

        // ----------------------------------------------------
        // RESTORE BUTTON
        // ----------------------------------------------------

        if (button) {

            button.disabled =
                false;

            button.style.opacity =
                "1";

            button.style.cursor =
                "pointer";

            button.innerText =
                originalText ||
                "🤖 Ask AI Tutor";

        }

    }

}


// ============================================================
// MAKE askAI AVAILABLE TO HTML onclick
// ============================================================

window.askAI =
    askAI;


console.log(
    "✅ askAI() is available globally"
);


// ============================================================
// OPTIONAL ENTER / CTRL+ENTER SUPPORT
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const input =
            getAIQuestionInput();


        if (!input) {
            return;
        }


        input.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Enter" &&
                    (
                        event.ctrlKey ||
                        event.metaKey
                    )
                ) {

                    event.preventDefault();

                    askAI();

                }

            }
        );


        console.log(
            "✅ AI Tutor keyboard support enabled"
        );

    }
);


// ============================================================
// FINAL STATUS
// ============================================================

console.log(
    "🔐 Private Mwaniki Scholars AI Tutor ready."
);
```
