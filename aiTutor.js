import { supabase } from "./supabase.js";

// ============================================================
// MWANIKI SCHOLARS — REAL AI TUTOR
// ============================================================
// The browser does NOT contain an AI API secret.
//
// Flow:
// Student question
//      ↓
// Supabase Edge Function
//      ↓
// Mwaniki Scholars database retrieval
//      ↓
// AI model
//      ↓
// Synthesized answer
//
// This is different from simply displaying matching database rows.
// ============================================================

console.log("🤖 Mwaniki Scholars Real AI Tutor Loaded");


// ============================================================
// ELEMENTS
// ============================================================

function getQuestionInput() {

    const ids = [
        "aiQuestion",
        "aiInput",
        "studentQuestion",
        "tutorQuestion",
        "aiTutorQuestion"
    ];

    for (const id of ids) {

        const element =
            document.getElementById(id);

        if (element) {
            return element;
        }
    }

    return null;
}


function getAskButton() {

    return (
        document.getElementById("askAIButton") ||
        document.querySelector('[onclick="askAI()"]')
    );
}


function getAnswerBox() {

    return document.getElementById("aiAnswer");
}


// ============================================================
// DISPLAY ANSWER
// ============================================================

function displayAIAnswer(answer, sources = []) {

    const answerBox =
        getAnswerBox();

    if (!answerBox) {

        console.error(
            "❌ #aiAnswer was not found."
        );

        return;
    }

    answerBox.innerHTML = "";

    const container =
        document.createElement("div");

    container.className =
        "mwaniki-ai-response";


    const answerContent =
        document.createElement("div");

    answerContent.className =
        "mwaniki-ai-answer-content";

    answerContent.textContent =
        answer || "No answer was returned.";

    answerContent.style.whiteSpace =
        "pre-wrap";

    answerContent.style.lineHeight =
        "1.75";


    container.appendChild(
        answerContent
    );


    // --------------------------------------------------------
    // SOURCES
    // --------------------------------------------------------

    if (
        Array.isArray(sources) &&
        sources.length > 0
    ) {

        const sourceSection =
            document.createElement("div");

        sourceSection.className =
            "mwaniki-ai-sources";


        const heading =
            document.createElement("h4");

        heading.textContent =
            "📚 Mwaniki Scholars Sources";

        sourceSection.appendChild(
            heading
        );


        const list =
            document.createElement("ul");


        sources.forEach(source => {

            const item =
                document.createElement("li");

            const table =
                source.table ||
                source.source ||
                "Mwaniki Scholars";

            const title =
                source.title ||
                source.unit ||
                source.course ||
                source.name ||
                "Educational material";

            item.textContent =
                `${table} — ${title}`;

            list.appendChild(item);

        });


        sourceSection.appendChild(
            list
        );

        container.appendChild(
            sourceSection
        );

    }


    answerBox.appendChild(
        container
    );
}


// ============================================================
// LOADING DISPLAY
// ============================================================

function displayAILoading() {

    const answerBox =
        getAnswerBox();

    if (!answerBox) {
        return;
    }

    answerBox.innerHTML = `
        <div class="mwaniki-ai-loading">

            <div class="loading-spinner"></div>

            <strong>
                🤖 Mwaniki AI is thinking...
            </strong>

            <p>
                Searching Mwaniki Scholars material
                and preparing your answer.
            </p>

        </div>
    `;
}


// ============================================================
// ERROR DISPLAY
// ============================================================

function displayAIError(message) {

    const answerBox =
        getAnswerBox();

    if (!answerBox) {
        return;
    }

    answerBox.innerHTML = "";

    const error =
        document.createElement("div");

    error.className =
        "mwaniki-ai-error";

    error.textContent =
        `⚠️ ${message}`;

    answerBox.appendChild(
        error
    );
}


// ============================================================
// ASK AI
// ============================================================

async function askAI() {

    console.log(
        "🤖 askAI() started"
    );


    const input =
        getQuestionInput();

    const button =
        getAskButton();


    if (!input) {

        console.error(
            "❌ AI question input not found."
        );

        displayAIError(
            "The AI question box could not be found."
        );

        return;
    }


    const question =
        input.value.trim();


    if (!question) {

        displayAIError(
            "Please type a medical question first."
        );

        input.focus();

        return;
    }


    // --------------------------------------------------------
    // BUTTON STATE
    // --------------------------------------------------------

    const originalText =
        button
            ? button.textContent
            : "";


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "🔎 Mwaniki AI is searching...";

        button.style.opacity =
            "0.7";

        button.style.cursor =
            "wait";
    }


    displayAILoading();


    try {

        // ----------------------------------------------------
        // CALL SUPABASE EDGE FUNCTION
        // ----------------------------------------------------

        const {
            data,
            error
        } = await supabase.functions.invoke(
            "mwaniki-ai",
            {
                body: {
                    question
                }
            }
        );


        if (error) {

            console.error(
                "❌ AI Edge Function error:",
                error
            );

            throw new Error(
                error.message ||
                "The AI service could not be reached."
            );
        }


        if (!data) {

            throw new Error(
                "The AI service returned no data."
            );
        }


        console.log(
            "🤖 AI response:",
            data
        );


        // ----------------------------------------------------
        // DISPLAY REAL AI RESPONSE
        // ----------------------------------------------------

        displayAIAnswer(
            data.answer ||
            "The AI did not return an answer.",
            data.sources ||
            []
        );


        // ----------------------------------------------------
        // SAVE RECENT AI QUESTION
        // ----------------------------------------------------

        try {

            const existing =
                JSON.parse(
                    localStorage.getItem(
                        "mwanikiAIQuestions"
                    ) || "[]"
                );


            existing.unshift({

                question,

                timestamp:
                    new Date().toISOString()

            });


            localStorage.setItem(
                "mwanikiAIQuestions",
                JSON.stringify(
                    existing.slice(0, 10)
                )
            );

        } catch (storageError) {

            console.warn(
                "Could not save AI history:",
                storageError
            );

        }


        console.log(
            "✅ Real AI answer displayed"
        );

    } catch (error) {

        console.error(
            "❌ Mwaniki AI error:",
            error
        );


        displayAIError(
            error.message ||
            "The AI Tutor could not answer the question right now."
        );

    } finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                originalText ||
                "🤖 Ask Mwaniki AI ➤";

            button.style.opacity =
                "1";

            button.style.cursor =
                "pointer";
        }

    }

}


// ============================================================
// GLOBAL ACCESS
// ============================================================

window.askAI =
    askAI;


console.log(
    "✅ window.askAI() is available"
);


// ============================================================
// ENTER / CTRL+ENTER
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const input =
            getQuestionInput();

        if (!input) {
            return;
        }


        input.addEventListener(
            "keydown",
            event => {

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

    }
);
