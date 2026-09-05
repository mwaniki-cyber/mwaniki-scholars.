import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS - SUPABASE QUIZ ENGINE
// =====================================================

console.log("📝 Mwaniki Scholars Supabase Quiz Engine Loaded");


// =====================================================
// GET QUIZ AREA
// =====================================================

function getQuizArea() {
    const quizArea = document.getElementById("quizArea");

    if (!quizArea) {
        console.error("❌ #quizArea was not found");
        return null;
    }

    return quizArea;
}


// =====================================================
// HTML ESCAPE
// =====================================================

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =====================================================
// QUIZ STATE
// =====================================================

let quizQuestions = [];
let currentQuestion = 0;
let userAnswers = {};

let activeCourseId = null;
let activeUnitId = null;
let activeUnitTitle = "";


// =====================================================
// LOAD QUIZ FROM SUPABASE
// =====================================================

async function loadQuiz(courseId, unitId, unitTitle = "") {

    const quizArea = getQuizArea();

    if (!quizArea) {
        return;
    }

    activeCourseId = Number(courseId);
    activeUnitId = Number(unitId);
    activeUnitTitle = unitTitle || "";

    console.log("=======================================");
    console.log("📝 LOADING SUPABASE QUIZ");
    console.log("Course ID:", activeCourseId);
    console.log("Unit ID:", activeUnitId);
    console.log("Unit:", activeUnitTitle);
    console.log("=======================================");


    // -------------------------------------------------
    // Validate IDs
    // -------------------------------------------------

    if (!Number.isFinite(activeCourseId) || !Number.isFinite(activeUnitId)) {

        console.error("❌ Invalid course/unit ID");

        quizArea.innerHTML = `
            <div class="error">
                <h2>Unable to load quiz</h2>
                <p>Invalid course or unit information.</p>
            </div>
        `;

        return;
    }


    // -------------------------------------------------
    // Loading screen
    // -------------------------------------------------

    quizArea.innerHTML = `
        <div class="loading">
            <h2>📝 Loading Quiz...</h2>
            <p>Loading questions from Supabase...</p>
        </div>
    `;


    try {

        // =================================================
        // IMPORTANT:
        // QUESTIONS COME FROM SUPABASE
        // NOT GITHUB
        // =================================================

        let { data, error } = await supabase
            .from("quizzes")
            .select(`
                id,
                course_id,
                question,
                option_a,
                option_b,
                option_c,
                option_d,
                correct_answer,
                created_at,
                course,
                unit
            `)
            .eq("course_id", activeCourseId)
            .eq("unit", activeUnitTitle)
            .order("id", { ascending: true });


        // -------------------------------------------------
        // If unit title matching fails, try course + unit
        // using the unit ID if your quizzes table has it.
        // -------------------------------------------------

        if (error) {

            console.error("❌ Supabase quiz query failed:", error);

            throw error;
        }


        console.log("✅ Quiz questions returned:", data);
        console.log(
            "📊 Number of questions:",
            data ? data.length : 0
        );


        // -------------------------------------------------
        // No questions
        // -------------------------------------------------

        if (!data || data.length === 0) {

            console.warn(
                "⚠️ No quiz questions found for:",
                activeCourseId,
                activeUnitTitle
            );

            quizArea.innerHTML = `
                <div class="error">

                    <h2>📝 No Quiz Available</h2>

                    <p>
                        No questions were found for this unit.
                    </p>

                    <p>
                        Course ID: ${escapeHTML(activeCourseId)}
                    </p>

                    <p>
                        Unit: ${escapeHTML(activeUnitTitle)}
                    </p>

                    <button
                        type="button"
                        onclick="history.back()"
                    >
                        ← Back to Course
                    </button>

                </div>
            `;

            return;
        }


        // -------------------------------------------------
        // Store questions
        // -------------------------------------------------

        quizQuestions = data;

        currentQuestion = 0;
        userAnswers = {};


        // -------------------------------------------------
        // Render quiz
        // -------------------------------------------------

        renderQuiz();

    } catch (error) {

        console.error("❌ FAILED TO LOAD QUIZ FROM SUPABASE");
        console.error(error);

        quizArea.innerHTML = `
            <div class="error">

                <h2>❌ Quiz Loading Error</h2>

                <p>
                    We could not load the quiz from Supabase.
                </p>

                <p>
                    Please check your internet connection and try again.
                </p>

                <button
                    type="button"
                    onclick="location.reload()"
                >
                    🔄 Try Again
                </button>

            </div>
        `;
    }
}


// =====================================================
// RENDER CURRENT QUESTION
// =====================================================

function renderQuiz() {

    const quizArea = getQuizArea();

    if (!quizArea) {
        return;
    }

    if (!quizQuestions.length) {
        return;
    }


    const q = quizQuestions[currentQuestion];

    const total = quizQuestions.length;

    const questionNumber = currentQuestion + 1;


    // -------------------------------------------------
    // Preserve selected answer
    // -------------------------------------------------

    const selectedAnswer = userAnswers[q.id] || "";


    quizArea.innerHTML = `

        <div class="quiz-container">

            <div class="quiz-header">

                <h2>
                    ${escapeHTML(activeUnitTitle)}
                </h2>

                <p>
                    Question ${questionNumber} of ${total}
                </p>

            </div>


            <div class="quiz-question">

                <h3>
                    ${escapeHTML(q.question)}
                </h3>


                <div class="quiz-options">

                    <label class="quiz-option">

                        <input
                            type="radio"
                            name="answer"
                            value="A"
                            ${selectedAnswer === "A" ? "checked" : ""}
                        >

                        <span>
                            A. ${escapeHTML(q.option_a)}
                        </span>

                    </label>


                    <label class="quiz-option">

                        <input
                            type="radio"
                            name="answer"
                            value="B"
                            ${selectedAnswer === "B" ? "checked" : ""}
                        >

                        <span>
                            B. ${escapeHTML(q.option_b)}
                        </span>

                    </label>


                    <label class="quiz-option">

                        <input
                            type="radio"
                            name="answer"
                            value="C"
                            ${selectedAnswer === "C" ? "checked" : ""}
                        >

                        <span>
                            C. ${escapeHTML(q.option_c)}
                        </span>

                    </label>


                    <label class="quiz-option">

                        <input
                            type="radio"
                            name="answer"
                            value="D"
                            ${selectedAnswer === "D" ? "checked" : ""}
                        >

                        <span>
                            D. ${escapeHTML(q.option_d)}
                        </span>

                    </label>

                </div>

            </div>


            <div class="quiz-navigation">

                ${
                    currentQuestion > 0
                    ?
                    `
                    <button
                        type="button"
                        id="previousQuestion"
                    >
                        ← Previous
                    </button>
                    `
                    :
                    ""
                }


                ${
                    currentQuestion < total - 1
                    ?
                    `
                    <button
                        type="button"
                        id="nextQuestion"
                    >
                        Next →
                    </button>
                    `
                    :
                    `
                    <button
                        type="button"
                        id="submitQuiz"
                    >
                        Submit Quiz
                    </button>
                    `
                }

            </div>

        </div>
    `;


    // =================================================
    // BUTTON EVENTS
    // =================================================

    const answerInputs =
        document.querySelectorAll(
            'input[name="answer"]'
        );


    answerInputs.forEach(input => {

        input.addEventListener("change", () => {

            userAnswers[q.id] = input.value;

        });

    });


    const nextButton =
        document.getElementById("nextQuestion");

    if (nextButton) {

        nextButton.addEventListener(
            "click",
            nextQuestion
        );

    }


    const previousButton =
        document.getElementById("previousQuestion");

    if (previousButton) {

        previousButton.addEventListener(
            "click",
            previousQuestion
        );

    }


    const submitButton =
        document.getElementById("submitQuiz");

    if (submitButton) {

        submitButton.addEventListener(
            "click",
            submitQuiz
        );

    }

}


// =====================================================
// NEXT QUESTION
// =====================================================

function nextQuestion() {

    const q = quizQuestions[currentQuestion];

    if (!userAnswers[q.id]) {

        alert("Please select an answer first.");

        return;
    }


    if (currentQuestion < quizQuestions.length - 1) {

        currentQuestion++;

        renderQuiz();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }

}


// =====================================================
// PREVIOUS QUESTION
// =====================================================

function previousQuestion() {

    if (currentQuestion > 0) {

        currentQuestion--;

        renderQuiz();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }

}


// =====================================================
// SUBMIT QUIZ
// =====================================================

function submitQuiz() {

    const q = quizQuestions[currentQuestion];


    if (!userAnswers[q.id]) {

        alert("Please select an answer first.");

        return;
    }


    let score = 0;


    quizQuestions.forEach(question => {

        const selected =
            userAnswers[question.id];

        const correct =
            String(question.correct_answer)
                .trim()
                .toUpperCase();


        if (selected === correct) {

            score++;

        }

    });


    const total = quizQuestions.length;

    const percentage =
        Math.round((score / total) * 100);


    // -------------------------------------------------
    // Save progress locally
    // -------------------------------------------------

    try {

        const progress = {

            courseId: activeCourseId,

            unitId: activeUnitId,

            unitTitle: activeUnitTitle,

            score: score,

            total: total,

            percentage: percentage,

            completedAt: new Date().toISOString()

        };


        localStorage.setItem(
            "mwanikiQuizProgress",
            JSON.stringify(progress)
        );

    } catch (storageError) {

        console.warn(
            "⚠️ Could not save quiz progress:",
            storageError
        );

    }


    // -------------------------------------------------
    // Show result
    // -------------------------------------------------

    const quizArea = getQuizArea();

    if (!quizArea) {
        return;
    }


    quizArea.innerHTML = `

        <div class="quiz-result">

            <h2>
                🎉 Quiz Complete
            </h2>

            <h3>
                ${escapeHTML(activeUnitTitle)}
            </h3>


            <div class="score">

                <strong>
                    ${score} / ${total}
                </strong>

            </div>


            <p>
                Score: ${percentage}%
            </p>


            <button
                type="button"
                id="retryQuiz"
            >
                🔄 Retry Quiz
            </button>


            <button
                type="button"
                onclick="history.back()"
            >
                ← Back to Course
            </button>

        </div>

    `;


    const retryButton =
        document.getElementById("retryQuiz");


    if (retryButton) {

        retryButton.addEventListener(
            "click",
            () => {

                currentQuestion = 0;

                userAnswers = {};

                renderQuiz();

            }
        );

    }

}


// =====================================================
// MAKE LOADQUIZ AVAILABLE TO COURSE.JS
// =====================================================

window.loadQuiz = loadQuiz;


// =====================================================
// INITIALIZE QUIZ PAGE
// =====================================================

async function initializeQuizPage() {

    console.log(
        "🚀 Initializing Mwaniki Scholars Quiz Page..."
    );


    const params =
        new URLSearchParams(
            window.location.search
        );


    // -------------------------------------------------
    // Get course ID
    // -------------------------------------------------

    let courseId =
        params.get("course");


    // -------------------------------------------------
    // Get unit ID
    // -------------------------------------------------

    let unitId =
        params.get("unit_id");


    // -------------------------------------------------
    // Get unit title
    // -------------------------------------------------

    let unitTitle =
        params.get("unit");


    // -------------------------------------------------
    // Fallback to localStorage
    // -------------------------------------------------

    if (!courseId) {

        courseId =
            localStorage.getItem(
                "selectedCourse"
            );

    }


    if (!unitId) {

        unitId =
            localStorage.getItem(
                "selectedUnit"
            );

    }


    if (!unitTitle) {

        unitTitle =
            localStorage.getItem(
                "selectedUnitName"
            );

    }


    console.log(
        "📚 Final Course ID:",
        courseId
    );

    console.log(
        "📚 Final Unit ID:",
        unitId
    );

    console.log(
        "📚 Final Unit:",
        unitTitle
    );


    if (!courseId || !unitId) {

        const quizArea = getQuizArea();

        if (quizArea) {

            quizArea.innerHTML = `

                <div class="error">

                    <h2>
                        ❌ Quiz Information Missing
                    </h2>

                    <p>
                        Course or unit information was not supplied.
                    </p>

                    <button
                        type="button"
                        onclick="history.back()"
                    >
                        ← Back
                    </button>

                </div>

            `;

        }

        return;
    }


    await loadQuiz(
        courseId,
        unitId,
        unitTitle
    );

}


// =====================================================
// START
// =====================================================

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeQuizPage
    );

} else {

    initializeQuizPage();

}
