```javascript
import { supabase } from "./supabase.js";

/* ============================================================
   MWANIKI SCHOLARS — PRIVATE AI TUTOR
   ============================================================

   Purpose:
   - Read questions from the dashboard
   - Search Mwaniki Scholars notes
   - Search quiz questions/answers
   - Search uploaded/admin learning material
   - Return the most relevant stored knowledge
   - No external AI API required for the knowledge search
   ============================================================ */

console.log("🤖 Mwaniki Scholars Private AI Tutor Loaded");


/* ============================================================
   ELEMENTS
   ============================================================ */

let questionBox = null;
let answerBox = null;
let askButton = null;


/* ============================================================
   INITIALIZE
   ============================================================ */

function initializeAITutor() {

    questionBox =
        document.getElementById("aiQuestion");

    answerBox =
        document.getElementById("aiAnswer");

    askButton =
        document.getElementById("askAIButton");


    console.log(
        "🔎 AI Tutor elements:",
        {
            questionBox: !!questionBox,
            answerBox: !!answerBox,
            askButton: !!askButton
        }
    );


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

        return;
    }


    /* Prevent duplicate listeners */

    askButton.removeEventListener(
        "click",
        askAI
    );


    askButton.addEventListener(
        "click",
        askAI
    );


    console.log(
        "✅ AI Tutor button connected"
    );

}


/* ============================================================
   WAIT FOR DOM
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeAITutor
    );

} else {

    initializeAITutor();

}


/* ============================================================
   CLEAN TEXT
   ============================================================ */

function cleanText(text) {

    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();

}


/* ============================================================
   TOKENIZE QUESTION
   ============================================================ */

function getKeywords(question) {

    const stopWords = new Set([

        "what",
        "what is",
        "what are",
        "who",
        "where",
        "when",
        "why",
        "how",
        "which",
        "the",
        "a",
        "an",
        "is",
        "are",
        "was",
        "were",
        "of",
        "in",
        "on",
        "to",
        "for",
        "and",
        "or",
        "with",
        "from",
        "does",
        "do",
        "can",
        "may",
        "explain",
        "describe",
        "tell",
        "me",
        "about",
        "please"
    ]);


    return cleanText(question)
        .toLowerCase()
        .replace(
            /[^a-z0-9\s]/g,
            " "
        )
        .split(/\s+/)
        .filter(
            word =>
                word.length >= 3 &&
                !stopWords.has(word)
        );

}


/* ============================================================
   SCORE SEARCH RESULT
   ============================================================ */

function scoreResult(
    question,
    row
) {

    const keywords =
        getKeywords(question);


    const text = cleanText(
        [
            row.title,
            row.content,
            row.course,
            row.unit,
            row.source_type
        ].join(" ")
    ).toLowerCase();


    if (!text) {

        return 0;

    }


    let score = 0;


    keywords.forEach(
        keyword => {

            if (
                text.includes(keyword)
            ) {

                score += 1;

            }

        }
    );


    /* Exact phrase gets additional weight */

    const normalizedQuestion =
        cleanText(question)
            .toLowerCase();


    if (
        normalizedQuestion.length > 5 &&
        text.includes(normalizedQuestion)
    ) {

        score += 10;

    }


    /* Title matches are more important */

    const title =
        cleanText(row.title)
            .toLowerCase();


    keywords.forEach(
        keyword => {

            if (
                title.includes(keyword)
            ) {

                score += 3;

            }

        }
    );


    return score;

}


/* ============================================================
   SEARCH KNOWLEDGE TABLE
   ============================================================ */

async function searchKnowledgeTable(
    question
) {

    console.log(
        "🔍 Searching Mwaniki Scholars knowledge..."
    );


    const keywords =
        getKeywords(question);


    if (
        keywords.length === 0
    ) {

        return [];

    }


    /*
       Search the knowledge table.

       This table should contain:
       - notes
       - quiz questions
       - uploaded learning material
       - other approved study content
    */

    const searchTerms =
        keywords
            .slice(0, 8)
            .join(" ");


    const { data, error } =
        await supabase
            .from("ai_knowledge")
            .select("*")
            .or(
                `title.ilike.%${searchTerms}%,content.ilike.%${searchTerms}%`
            )
            .limit(100);


    if (error) {

        console.error(
            "❌ ai_knowledge search error:",
            error
        );


        return [];

    }


    if (!data) {

        return [];

    }


    return data
        .map(row => ({

            ...row,

            relevance:
                scoreResult(
                    question,
                    row
                )

        }))
        .filter(
            row =>
                row.relevance > 0
        )
        .sort(
            (a, b) =>
                b.relevance -
                a.relevance
        );

}


/* ============================================================
   FALLBACK — SEARCH QUIZZES DIRECTLY
   ============================================================ */

async function searchQuizzes(
    question
) {

    console.log(
        "📝 Searching quiz database..."
    );


    const keywords =
        getKeywords(question);


    if (
        keywords.length === 0
    ) {

        return [];

    }


    const { data, error } =
        await supabase
            .from("quizzes")
            .select("*")
            .limit(300);


    if (error) {

        console.warn(
            "⚠️ Quiz table search unavailable:",
            error.message
        );

        return [];

    }


    if (!data) {

        return [];

    }


    return data
        .map(row => ({

            ...row,

            source_type: "quiz",

            title:
                row.title ||
                "Quiz Question",

            content:
                row.content ||
                row.question ||
                "",

            relevance:
                scoreResult(
                    question,
                    {
                        ...row,
                        title:
                            row.title ||
                            "Quiz Question",

                        content:
                            row.content ||
                            row.question ||
                            ""
                    }
                )

        }))
        .filter(
            row =>
                row.relevance > 0
        )
        .sort(
            (a, b) =>
                b.relevance -
                a.relevance
        );

}


/* ============================================================
   SEARCH NOTES DIRECTLY
   ============================================================ */

async function searchNotes(
    question
) {

    console.log(
        "📚 Searching notes..."
    );


    const { data, error } =
        await supabase
            .from("notes")
            .select("*")
            .limit(300);


    if (error) {

        console.warn(
            "⚠️ Notes search unavailable:",
            error.message
        );

        return [];

    }


    if (!data) {

        return [];

    }


    return data
        .map(note => {

            const row = {

                ...note,

                title:
                    note.title ||
                    note.file_name ||
                    note.filename ||
                    "Medical Note",

                content:
                    note.content ||
                    note.description ||
                    "",

                source_type:
                    "note"

            };


            return {

                ...row,

                relevance:
                    scoreResult(
                        question,
                        row
                    )

            };

        })
        .filter(
            row =>
                row.relevance > 0
        )
        .sort(
            (a, b) =>
                b.relevance -
                a.relevance
        );

}


/* ============================================================
   BUILD ANSWER FROM STORED KNOWLEDGE
   ============================================================ */

function buildAnswer(
    question,
    results
) {

    if (
        !results ||
        results.length === 0
    ) {

        return `

            <div class="ai-response">

                <h3>🤖 Mwaniki Scholars AI Tutor</h3>

                <p>
                    I could not find a sufficiently relevant
                    answer in the Mwaniki Scholars knowledge
                    base.
                </p>

                <p>
                    Try asking the question using specific
                    medical terms from your course or unit.
                </p>

            </div>

        `;

    }


    /*
       Keep only the strongest matches.
    */

    const selected =
        results.slice(0, 5);


    let html = `

        <div
            class="ai-response"
            style="
                background:#f4f9ff;
                border-left:5px solid #0b7285;
                padding:20px;
                border-radius:12px;
            "
        >

            <h3
                style="
                    color:#063970;
                    margin-top:0;
                "
            >
                🤖 Mwaniki Scholars AI Tutor
            </h3>

            <p>
                Based on the Mwaniki Scholars
                learning material:
            </p>

    `;


    selected.forEach(
        (item, index) => {

            const title =
                cleanText(
                    item.title ||
                    "Learning Material"
                );


            const content =
                cleanText(
                    item.content
                );


            if (!content) {

                return;

            }


            html += `

                <div
                    style="
                        margin-top:15px;
                        padding:15px;
                        background:white;
                        border-radius:10px;
                        border:1px solid #dbe7ee;
                    "
                >

                    <strong>
                        ${escapeHTML(title)}
                    </strong>

                    <p
                        style="
                            color:#334155;
                            line-height:1.7;
                        "
                    >
                        ${escapeHTML(content)}
                    </p>

                </div>

            `;

        }
    );


    html += `

            <p
                style="
                    margin-top:20px;
                    font-size:13px;
                    color:#64748b;
                "
            >
                📚 Source: Mwaniki Scholars
                private knowledge base.
            </p>

        </div>

    `;


    return html;

}


/* ============================================================
   HTML ESCAPE
   ============================================================ */

function escapeHTML(
    text
) {

    return String(text || "")
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


/* ============================================================
   MAIN ASK AI FUNCTION
   ============================================================ */

async function askAI() {

    console.log(
        "🤖 askAI() triggered"
    );


    if (!questionBox) {

        questionBox =
            document.getElementById(
                "aiQuestion"
            );

    }


    if (!answerBox) {

        answerBox =
            document.getElementById(
                "aiAnswer"
            );

    }


    if (!questionBox) {

        console.error(
            "❌ Question box missing"
        );

        return;

    }


    if (!answerBox) {

        console.error(
            "❌ Answer box missing"
        );

        return;

    }


    const question =
        cleanText(
            questionBox.value
        );


    if (!question) {

        answerBox.innerHTML = `

            <div
                style="
                    background:#fff8e6;
                    padding:15px;
                    border-radius:10px;
                    color:#7a5b00;
                "
            >
                ✏️ Please enter a medical
                question first.
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

        <div
            style="
                background:#eef7fb;
                padding:18px;
                border-radius:12px;
            "
        >

            🔎 Searching Mwaniki Scholars
            notes and quizzes...

        </div>

    `;


    try {

        let results = [];


        /*
           PRIMARY:
           ai_knowledge table
        */

        const knowledgeResults =
            await searchKnowledgeTable(
                question
            );


        results.push(
            ...knowledgeResults
        );


        /*
           SECONDARY:
           notes table
        */

        const noteResults =
            await searchNotes(
                question
            );


        results.push(
            ...noteResults
        );


        /*
           TERTIARY:
           quizzes table
        */

        const quizResults =
            await searchQuizzes(
                question
            );


        results.push(
            ...quizResults
        );


        /*
           Re-rank everything together.
        */

        results =
            results
                .sort(
                    (a, b) =>
                        b.relevance -
                        a.relevance
                );


        /*
           Remove duplicate content.
        */

        const seen =
            new Set();


        results =
            results.filter(
                item => {

                    const key =
                        cleanText(
                            item.content
                        ).toLowerCase();


                    if (!key) {

                        return false;

                    }


                    if (
                        seen.has(key)
                    ) {

                        return false;

                    }


                    seen.add(key);

                    return true;

                }
            );


        console.log(
            "📚 AI knowledge matches:",
            results
        );


        answerBox.innerHTML =
            buildAnswer(
                question,
                results
            );


    } catch (error) {

        console.error(
            "❌ AI Tutor error:",
            error
        );


        answerBox.innerHTML = `

            <div
                style="
                    background:#fff1f2;
                    color:#9f1239;
                    padding:18px;
                    border-radius:12px;
                "
            >

                ❌ The private AI Tutor
                encountered an error.

                <br><br>

                Please check the browser console
                for the exact database error.

            </div>

        `;

    } finally {

        if (askButton) {

            askButton.disabled = false;

            askButton.textContent =
                "🤖 Ask AI Tutor";

        }

    }

}


/* ============================================================
   MAKE FUNCTION GLOBALLY AVAILABLE
   ============================================================ */

window.askAI = askAI;


console.log(
    "✅ askAI() is available globally"
);
```
