import { supabase } from "./supabase.js";

/* ============================================================
   MWANIKI SCHOLARS
   PRIVATE KNOWLEDGE-BASED AI MEDICAL TUTOR
   ============================================================ */

console.log("🤖 Mwaniki Scholars Private AI Tutor Loaded");


/* ============================================================
   CONFIGURATION
   ============================================================ */

const KNOWLEDGE_TABLE = "knowledge_base";

const SEARCH_LIMIT = 1000;

const REQUEST_TIMEOUT = 15000;


/* ============================================================
   DOM HELPERS
   ============================================================ */

function getQuestionBox() {
    return document.getElementById("aiQuestion");
}


function getAnswerBox() {
    return document.getElementById("aiAnswer");
}


function getAskButton() {
    return document.getElementById("askAIButton");
}


/* ============================================================
   HTML ESCAPE
   ============================================================ */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ============================================================
   NORMALIZE TEXT
   ============================================================ */

function normalizeText(value) {

    return String(value ?? "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}


/* ============================================================
   TOKENIZE
   ============================================================ */

function tokenize(value) {

    return normalizeText(value)
        .split(/\s+/)
        .filter(word => word.length >= 2);
}


/* ============================================================
   REMOVE COMMON WORDS
   ============================================================ */

const STOP_WORDS = new Set([
    "the",
    "and",
    "for",
    "with",
    "what",
    "which",
    "when",
    "where",
    "who",
    "how",
    "why",
    "are",
    "is",
    "was",
    "were",
    "does",
    "do",
    "did",
    "can",
    "may",
    "a",
    "an",
    "of",
    "to",
    "in",
    "on",
    "from",
    "by",
    "as",
    "or",
    "be",
    "its",
    "it",
    "this",
    "that",
    "their",
    "there",
    "than",
    "into",
    "about",
    "primary",
    "main",
    "function"
]);


function usefulTokens(text) {

    return tokenize(text)
        .filter(word => !STOP_WORDS.has(word));
}


/* ============================================================
   REQUEST WITH TIMEOUT
   ============================================================ */

async function withTimeout(promise, milliseconds) {

    let timer;

    const timeoutPromise =
        new Promise((_, reject) => {

            timer = setTimeout(() => {

                reject(
                    new Error(
                        "The knowledge-base request timed out."
                    )
                );

            }, milliseconds);

        });


    try {

        return await Promise.race([
            promise,
            timeoutPromise
        ]);

    } finally {

        clearTimeout(timer);

    }
}


/* ============================================================
   LOAD KNOWLEDGE
   ============================================================ */

async function loadKnowledge() {

    console.log(
        "📚 Loading Mwaniki Scholars knowledge base..."
    );


    const query =
        supabase
            .from(KNOWLEDGE_TABLE)
            .select(
                "id, source_type, course_id, unit_id, title, content"
            )
            .limit(SEARCH_LIMIT);


    const result =
        await withTimeout(
            query,
            REQUEST_TIMEOUT
        );


    if (result.error) {

        console.error(
            "❌ Knowledge-base query failed:",
            result.error
        );

        throw result.error;
    }


    const records =
        Array.isArray(result.data)
            ? result.data
            : [];


    console.log(
        `📚 Knowledge records loaded: ${records.length}`
    );


    return records;
}


/* ============================================================
   SCORE KNOWLEDGE RECORD
   ============================================================ */

function scoreRecord(question, record) {

    const questionWords =
        usefulTokens(question);


    if (questionWords.length === 0) {
        return 0;
    }


    const title =
        normalizeText(
            record.title
        );


    const content =
        normalizeText(
            record.content
        );


    const combined =
        `${title} ${content}`;


    let score = 0;


    for (const word of questionWords) {

        if (title.includes(word)) {

            score += 12;

        }


        if (content.includes(word)) {

            score += 5;

        }


        const occurrences =
            combined
                .split(word)
                .length - 1;


        score +=
            Math.min(
                occurrences,
                5
            );
    }


    /*
       Strong bonus when several question words
       appear close together.
    */

    for (
        let i = 0;
        i < questionWords.length - 1;
        i++
    ) {

        const pair =
            `${questionWords[i]} ${questionWords[i + 1]}`;


        if (combined.includes(pair)) {

            score += 15;

        }
    }


    /*
       Quiz records are particularly useful when
       the user's question resembles the quiz question.
    */

    if (
        String(record.source_type)
            .toLowerCase() === "quiz"
    ) {

        score += 3;

    }


    return score;
}


/* ============================================================
   FIND RELEVANT MATERIAL
   ============================================================ */

function findRelevantMaterial(
    question,
    records
) {

    const scored =
        records
            .map(record => ({

                record,

                score:
                    scoreRecord(
                        question,
                        record
                    )

            }))
            .filter(item => item.score > 0)
            .sort(
                (a, b) =>
                    b.score - a.score
            );


    /*
       Avoid returning a huge amount of material.
    */

    return scored
        .slice(0, 8);
}


/* ============================================================
   DETECT QUIZ QUESTION
   ============================================================ */

function looksLikeQuizQuestion(
    question,
    record
) {

    const source =
        String(
            record.source_type || ""
        ).toLowerCase();


    if (source !== "quiz") {

        return false;

    }


    const content =
        String(
            record.content || ""
        );


    return (
        /question\s*:/i.test(content) &&
        /correct\s*answer\s*:/i.test(content)
    );
}


/* ============================================================
   EXTRACT QUIZ ANSWER
   ============================================================ */

function extractQuizAnswer(content) {

    const match =
        String(content || "")
            .match(
                /correct\s*answer\s*:\s*(.+)$/im
            );


    if (!match) {

        return null;

    }


    return match[1]
        .trim()
        .replace(/\s+/g, " ");
}


/* ============================================================
   EXTRACT QUIZ QUESTION
   ============================================================ */

function extractQuizQuestion(content) {

    const match =
        String(content || "")
            .match(
                /question\s*:\s*(.+?)(?:\n|options\s*:)/is
            );


    if (!match) {

        return "";

    }


    return match[1]
        .trim()
        .replace(/\s+/g, " ");
}


/* ============================================================
   DETERMINE DIRECT QUIZ MATCH
   ============================================================ */

function findDirectQuizAnswer(
    question,
    matches
) {

    const questionWords =
        usefulTokens(question);


    if (questionWords.length === 0) {

        return null;

    }


    let best = null;


    for (const item of matches) {

        const record =
            item.record;


        if (
            !looksLikeQuizQuestion(
                question,
                record
            )
        ) {

            continue;

        }


        const quizQuestion =
            extractQuizQuestion(
                record.content
            );


        if (!quizQuestion) {

            continue;

        }


        const quizWords =
            usefulTokens(
                quizQuestion
            );


        let overlap = 0;


        for (
            const word of questionWords
        ) {

            if (
                quizWords.includes(word)
            ) {

                overlap++;

            }

        }


        const ratio =
            questionWords.length > 0
                ? overlap /
                  questionWords.length
                : 0;


        if (
            ratio >= 0.45 &&
            (
                !best ||
                ratio > best.ratio
            )
        ) {

            best = {

                answer:
                    extractQuizAnswer(
                        record.content
                    ),

                question:
                    quizQuestion,

                record,

                ratio

            };

        }

    }


    return best;
}


/* ============================================================
   SELECT BEST SOURCE
   ============================================================ */

function selectBestSource(
    matches
) {

    if (
        !matches ||
        matches.length === 0
    ) {

        return null;

    }


    return matches[0];

}


/* ============================================================
   CREATE ANSWER FROM KNOWLEDGE
   ============================================================ */

function generateKnowledgeAnswer(
    question,
    matches
) {

    /*
       First try to identify whether the user
       is asking something directly answered by
       one of the quiz questions.
    */

    const directQuiz =
        findDirectQuizAnswer(
            question,
            matches
        );


    if (
        directQuiz &&
        directQuiz.answer
    ) {

        return {

            type: "quiz",

            html: `
                <div class="ai-response">

                    <h3>
                        🤖 Mwaniki Scholars Tutor
                    </h3>

                    <p>
                        <strong>Answer:</strong>
                        ${escapeHTML(
                            directQuiz.answer
                        )}
                    </p>

                    <p>
                        📚 This answer was found
                        directly in the Mwaniki Scholars
                        quiz knowledge base.
                    </p>

                    <div class="source-result">

                        <strong>
                            📝 Quiz source
                        </strong>

                        <h4>
                            ${escapeHTML(
                                directQuiz.record.title ||
                                "Quiz Question"
                            )}
                        </h4>

                        <p>
                            ${escapeHTML(
                                directQuiz.question
                            )}
                        </p>

                    </div>

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
                        🔒 Answer sourced exclusively
                        from Mwaniki Scholars study
                        material.
                    </div>

                </div>
            `

        };

    }


    /*
       Otherwise use the strongest notes/quiz
       records and present them as a focused answer.
    */

    const best =
        selectBestSource(matches);


    if (!best) {

        return null;

    }


    const source =
        best.record;


    const sourceType =
        String(
            source.source_type || ""
        ).toLowerCase() === "quiz"
            ? "📝 Quiz"
            : "📄 Note";


    const supporting =
        matches
            .slice(0, 4)
            .map(item => item.record);


    let html = `

        <div class="ai-response">

            <h3>
                🤖 Mwaniki Scholars Tutor
            </h3>

            <p>
                <strong>Question:</strong>
                ${escapeHTML(question)}
            </p>

            <div
                style="
                    background:#eef7fb;
                    border-left:4px solid #0b7285;
                    padding:15px;
                    border-radius:10px;
                    margin:15px 0;
                "
            >

                <strong>
                    📚 Relevant study material
                </strong>

                <p>
                    ${formatContent(
                        source.content || ""
                    )}
                </p>

            </div>

            ${
                supporting.length > 1
                    ? `
                        <h4>
                            🔎 Supporting Mwaniki
                            Scholars material
                        </h4>

                        ${supporting
                            .slice(1)
                            .map(
                                record => `

                                    <div
                                        class="source-result"
                                    >

                                        <strong>
                                            ${
                                                String(
                                                    record.source_type ||
                                                    ""
                                                ).toLowerCase() ===
                                                "quiz"
                                                    ? "📝 Quiz"
                                                    : "📄 Note"
                                            }
                                        </strong>

                                        <h4>
                                            ${escapeHTML(
                                                record.title ||
                                                "Study Material"
                                            )}
                                        </h4>

                                        <p>
                                            ${formatContent(
                                                record.content ||
                                                ""
                                            )}
                                        </p>

                                    </div>

                                `
                            )
                            .join("")
                        }
                    `
                    : ""
            }

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

                🔒 This response uses only
                Mwaniki Scholars knowledge-base
                material.

                <br><br>

                Source:
                ${sourceType}

            </div>

        </div>

    `;


    return {

        type: "knowledge",

        html

    };
}


/* ============================================================
   FORMAT CONTENT
   ============================================================ */

function formatContent(
    content
) {

    return escapeHTML(
        String(content || "")
    )
        .replace(
            /\r?\n/g,
            "<br>"
        );

}


/* ============================================================
   DISPLAY ERROR
   ============================================================ */

function displayError(
    message
) {

    const answerBox =
        getAnswerBox();


    if (!answerBox) {

        return;

    }


    answerBox.innerHTML = `

        <div class="ai-response">

            <h3>
                🤖 Mwaniki Scholars Tutor
            </h3>

            <p>
                ⚠️ ${escapeHTML(message)}
            </p>

            <p
                style="
                    font-size:13px;
                    color:#64748b;
                "
            >
                The tutor uses the private
                Mwaniki Scholars knowledge base.
            </p>

        </div>

    `;
}


/* ============================================================
   MAIN ASK FUNCTION
   ============================================================ */

async function askAI() {

    console.log(
        "🤖 Ask AI Tutor clicked"
    );


    const questionBox =
        getQuestionBox();


    const answerBox =
        getAnswerBox();


    const askButton =
        getAskButton();


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
        questionBox.value
            .trim();


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


    /*
       BUTTON LOCK
    */

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
                🔎 Searching your private notes
                and quiz knowledge base...
            </p>

        </div>

    `;


    try {

        /*
           LOAD KNOWLEDGE
        */

        const records =
            await loadKnowledge();


        if (
            !records ||
            records.length === 0
        ) {

            displayError(
                "The Mwaniki Scholars knowledge base is currently empty."
            );

            return;

        }


        /*
           SEARCH
        */

        const matches =
            findRelevantMaterial(
                question,
                records
            );


        console.log(
            "🔎 Matching records:",
            matches
        );


        if (
            !matches ||
            matches.length === 0
        ) {

            answerBox.innerHTML = `

                <div class="ai-response">

                    <h3>
                        🤖 Mwaniki Scholars Tutor
                    </h3>

                    <p>
                        📚 I could not find a sufficiently
                        relevant answer in the current
                        Mwaniki Scholars notes or quizzes.
                    </p>

                    <p>
                        Try asking with the exact
                        medical topic or terminology
                        used in the study material.
                    </p>

                    <div
                        style="
                            margin-top:15px;
                            padding:12px;
                            background:#eef7fb;
                            border-radius:10px;
                            font-size:13px;
                        "
                    >
                        🔒 The tutor does not invent
                        material outside the Mwaniki
                        Scholars knowledge base.
                    </div>

                </div>

            `;

            return;

        }


        /*
           GENERATE ANSWER
        */

        const response =
            generateKnowledgeAnswer(
                question,
                matches
            );


        if (!response) {

            displayError(
                "No usable answer could be created from the available study material."
            );

            return;

        }


        answerBox.innerHTML =
            response.html;


        console.log(
            "✅ Private knowledge answer generated"
        );

    }

    catch (error) {

        console.error(
            "❌ AI Tutor error:",
            error
        );


        displayError(
            error?.message ||
            "The private tutor could not access the knowledge base."
        );

    }

    finally {

        /*
           ALWAYS UNLOCK BUTTON
        */

        const button =
            getAskButton();


        if (button) {

            button.disabled = false;

            button.textContent =
                "🤖 Ask AI Tutor";

        }

    }

}


/* ============================================================
   GLOBAL FUNCTION
   ============================================================ */

window.askAI =
    askAI;


/* ============================================================
   ROBUST BUTTON BINDING
   ============================================================ */

function bindAIButton() {

    const button =
        getAskButton();


    if (!button) {

        console.warn(
            "⚠️ askAIButton not found during binding."
        );

        return;

    }


    /*
       Prevent duplicate listeners.
    */

    if (
        button.dataset.aiTutorBound === "true"
    ) {

        return;

    }


    button.dataset.aiTutorBound =
        "true";


    button.addEventListener(
        "click",
        function(event) {

            event.preventDefault();

            event.stopPropagation();

            askAI();

        }
    );


    console.log(
        "✅ AI Tutor button bound successfully"
    );

}


/* ============================================================
   INITIAL BIND
   ============================================================ */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        bindAIButton
    );

} else {

    bindAIButton();

}


/* ============================================================
   FALLBACK DOCUMENT LISTENER
   ============================================================ */

document.addEventListener(
    "click",
    function(event) {

        const target =
            event.target;


        if (
            target &&
            target.id === "askAIButton"
        ) {

            /*
               If the direct listener already handled
               it, this prevents accidental double execution.
            */

            if (
                target.dataset.aiTutorRunning === "true"
            ) {

                return;

            }

        }

    },
    true
);


/* ============================================================
   ENTER / CTRL+ENTER SUPPORT
   ============================================================ */

document.addEventListener(
    "keydown",
    function(event) {

        const target =
            event.target;


        if (
            !target ||
            target.id !== "aiQuestion"
        ) {

            return;

        }


        if (
            event.key === "Enter" &&
            (event.ctrlKey || event.metaKey)
        ) {

            event.preventDefault();

            askAI();

        }

    }
);


/* ============================================================
   FINAL STATUS
   ============================================================ */

console.log(
    "✅ askAI() available globally"
);

console.log(
    "✅ Mwaniki Scholars private AI Tutor ready"
);
