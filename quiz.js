import { supabase } from "./supabase.js";

// ============================================================
// MWANIKI SCHOLARS — SUPABASE QUIZ ENGINE
// ============================================================

console.log("📝 Mwaniki Scholars Supabase Quiz Engine Loaded");


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// GET QUIZ AREA
// ============================================================

function getQuizArea() {

    const quizArea = document.getElementById("quizArea");

    if (!quizArea) {
        console.error("❌ #quizArea was not found.");
        return null;
    }

    return quizArea;
}


// ============================================================
// GET QUIZ INFORMATION
// ============================================================

function getQuizInformation() {

    const params = new URLSearchParams(window.location.search);

    const courseId = params.get("course");
    const unitId = params.get("unit_id");
    const unitTitle = params.get("unit");

    return {
        courseId: courseId ? Number(courseId) : null,
        unitId: unitId ? Number(unitId) : null,
        unitTitle: unitTitle || ""
    };
}


// ============================================================
// LOAD QUIZ FROM SUPABASE
// ============================================================

window.loadQuiz = async function (
    courseId,
    unitId,
    unitTitle
) {

    console.log("======================================");
    console.log("📝 SUPABASE QUIZ REQUEST");
    console.log("Course ID:", courseId);
    console.log("Unit ID:", unitId);
    console.log("Unit:", unitTitle);
    console.log("======================================");

    const quizArea = getQuizArea();

    if (!quizArea) return;


    // --------------------------------------------------------
    // VALIDATE COURSE
    // --------------------------------------------------------

    if (!courseId) {

        quizArea.innerHTML = `
            <div class="quiz-error">
                <h2>❌ Course Not Selected</h2>
                <p>Please return to the course page and select a unit.</p>
            </div>
        `;

        return;
    }


    // --------------------------------------------------------
    // VALIDATE UNIT
    // --------------------------------------------------------

    if (!unitTitle) {

        quizArea.innerHTML = `
            <div class="quiz-error">
                <h2>❌ Unit Not Selected</h2>
                <p>Please return to the course page and select a unit.</p>
            </div>
        `;

        return;
    }


    // --------------------------------------------------------
    // LOADING
    // --------------------------------------------------------

    quizArea.innerHTML = `
        <div class="quiz-loading">
            <h2>📝 ${escapeHTML(unitTitle)}</h2>
            <p>⏳ Loading questions from Supabase...</p>
        </div>
    `;


    try {

        // ====================================================
        // IMPORTANT:
        // QUIZZES ARE LINKED USING:
        //
        // course_id
        // unit
        //
        // NOT unit_id
        // ====================================================

        const {
            data,
            error
        } = await supabase

            .from("quizzes")

            .select(`
                id,
                course_id,
                course,
                unit,
                question,
                option_a,
                option_b,
                option_c,
                option_d,
                correct_answer,
                created_at
            `)

            .eq("course_id", Number(courseId))

            .eq("unit", unitTitle)

            .order("id", {
                ascending: true
            });


        // ====================================================
        // SUPABASE ERROR
        // ====================================================

        if (error) {

            console.error(
                "❌ SUPABASE QUIZ ERROR:",
                error
            );

            quizArea.innerHTML = `
                <div class="quiz-error">

                    <h2>❌ Failed to Load Quiz</h2>

                    <p>
                        ${escapeHTML(error.message)}
                    </p>

                </div>
            `;

            return;
        }


        // ====================================================
        // DEBUG
        // ====================================================

        console.log(
            "✅ Questions returned from Supabase:",
            data
        );


        console.log(
            "📊 Number of questions:",
            data ? data.length : 0
        );


        // ====================================================
        // NO QUESTIONS
        // ====================================================

        if (!data || data.length === 0) {

            quizArea.innerHTML = `
                <div class="quiz-empty">

                    <h2>
                        📝 No Quiz Available
                    </h2>

                    <p>
                        No questions have been added yet for
                        <strong>
                            ${escapeHTML(unitTitle)}
                        </strong>.
                    </p>

                    <p>
                        Course ID:
                        <strong>${Number(courseId)}</strong>
                    </p>

                </div>
            `;

            return;
        }


        // ====================================================
        // RENDER
        // ====================================================

        renderQuiz(
            data,
            Number(courseId),
            unitId,
            unitTitle
        );

    } catch (error) {

        console.error(
            "❌ Unexpected quiz error:",
            error
        );

        quizArea.innerHTML = `
            <div class="quiz-error">

                <h2>❌ Quiz Error</h2>

                <p>
                    ${escapeHTML(error.message)}
                </p>

            </div>
        `;
    }
};


// ============================================================
// RENDER QUIZ
// ============================================================

function renderQuiz(
    questions,
    courseId,
    unitId,
    unitTitle
) {

    const quizArea = getQuizArea();

    if (!quizArea) return;


    let html = `

        <div class="quiz-container">

            <div class="quiz-header">

                <h1>
                    📝 ${escapeHTML(unitTitle)}
                </h1>

                <p>
                    ${questions.length}
                    question${questions.length === 1 ? "" : "s"}
                </p>

            </div>

            <form id="quizForm">
    `;


    questions.forEach((q, index) => {

        html += `

            <div
                class="quiz-question"
                style="
                    background:#ffffff;
                    padding:20px;
                    margin:18px 0;
                    border-radius:14px;
                    border:1px solid #d9edf2;
                "
            >

                <h3>

                    ${index + 1}.
                    ${escapeHTML(q.question)}

                </h3>


                <label
                    style="
                        display:block;
                        margin:12px 0;
                    "
                >

                    <input
                        type="radio"
                        name="question_${q.id}"
                        value="A"
                    >

                    A.
                    ${escapeHTML(q.option_a)}

                </label>


                <label
                    style="
                        display:block;
                        margin:12px 0;
                    "
                >

                    <input
                        type="radio"
                        name="question_${q.id}"
                        value="B"
                    >

                    B.
                    ${escapeHTML(q.option_b)}

                </label>


                <label
                    style="
                        display:block;
                        margin:12px 0;
                    "
                >

                    <input
                        type="radio"
                        name="question_${q.id}"
                        value="C"
                    >

                    C.
                    ${escapeHTML(q.option_c)}

                </label>


                <label
                    style="
                        display:block;
                        margin:12px 0;
                    "
                >

                    <input
                        type="radio"
                        name="question_${q.id}"
                        value="D"
                    >

                    D.
                    ${escapeHTML(q.option_d)}

                </label>

            </div>

        `;
    });


    html += `

                <button
                    type="button"
                    id="submitSupabaseQuiz"
                    style="
                        background:#0b7285;
                        color:white;
                        border:none;
                        padding:14px 25px;
                        border-radius:10px;
                        cursor:pointer;
                        font-size:16px;
                    "
                >
                    ✅ Submit Quiz
                </button>

            </form>

            <div id="quizResult"></div>

        </div>

    `;


    quizArea.innerHTML = html;


    // ========================================================
    // SUBMIT BUTTON
    // ========================================================

    const submitButton =
        document.getElementById(
            "submitSupabaseQuiz"
        );


    if (submitButton) {

        submitButton.addEventListener(
            "click",
            function () {

                calculateQuiz(
                    questions,
                    courseId,
                    unitId,
                    unitTitle
                );

            }
        );

    }

}


// ============================================================
// CALCULATE QUIZ
// ============================================================

function calculateQuiz(
    questions,
    courseId,
    unitId,
    unitTitle
) {

    let score = 0;


    questions.forEach(q => {

        const selected =
            document.querySelector(
                `input[name="question_${q.id}"]:checked`
            );


        if (
            selected &&
            String(selected.value).toUpperCase() ===
            String(q.correct_answer).toUpperCase()
        ) {

            score++;

        }

    });


    const total = questions.length;


    const percentage =
        total > 0
            ? Math.round(
                (score / total) * 100
            )
            : 0;


    const result =
        document.getElementById(
            "quizResult"
        );


    if (!result) return;


    let message;


    if (percentage >= 80) {

        message =
            "🎉 Excellent work!";

    } else if (percentage >= 70) {

        message =
            "👏 Good work!";

    } else if (percentage >= 50) {

        message =
            "📚 Keep studying and try again.";

    } else {

        message =
            "💪 Keep practicing. You can improve!";

    }


    result.innerHTML = `

        <div
            style="
                margin-top:25px;
                padding:25px;
                background:#eef7fb;
                border-radius:15px;
            "
        >

            <h2>
                🎯 Quiz Result
            </h2>

            <h3>
                ${score} / ${total}
            </h3>

            <h3>
                ${percentage}%
            </h3>

            <p>
                ${message}
            </p>

        </div>

    `;


    saveQuizProgress(
        courseId,
        unitId,
        unitTitle,
        score,
        total,
        percentage
    );

}


// ============================================================
// SAVE LOCAL PROGRESS
// ============================================================

function saveQuizProgress(
    courseId,
    unitId,
    unitTitle,
    score,
    total,
    percentage
) {

    let progress = [];


    try {

        progress =
            JSON.parse(
                localStorage.getItem(
                    "mwanikiQuizProgress"
                )
            ) || [];

    } catch (error) {

        progress = [];

    }


    progress.push({

        courseId: courseId,

        unitId: unitId,

        unit: unitTitle,

        score: score,

        total: total,

        percentage: percentage,

        date:
            new Date()
                .toISOString()

    });


    localStorage.setItem(
        "mwanikiQuizProgress",
        JSON.stringify(progress)
    );


    console.log(
        "📊 Quiz progress saved locally."
    );

}


// ============================================================
// AUTOMATIC INITIALIZATION
// ============================================================

async function initializeQuizPage() {

    console.log(
        "🚀 Initializing Supabase Quiz Page..."
    );


    const {
        courseId,
        unitId,
        unitTitle
    } = getQuizInformation();


    console.log(
        "📚 URL Course ID:",
        courseId
    );


    console.log(
        "📚 URL Unit ID:",
        unitId
    );


    console.log(
        "📚 URL Unit Title:",
        unitTitle
    );


    // --------------------------------------------------------
    // If course + unit came through URL, load automatically
    // --------------------------------------------------------

    if (
        courseId &&
        unitTitle
    ) {

        await window.loadQuiz(
            courseId,
            unitId,
            unitTitle
        );

        return;

    }


    // --------------------------------------------------------
    // Fallback to localStorage
    // --------------------------------------------------------

    const storedCourse =
        localStorage.getItem(
            "selectedCourse"
        );


    const storedUnit =
        localStorage.getItem(
            "selectedUnit"
        );


    const storedUnitTitle =
        localStorage.getItem(
            "selectedUnitTitle"
        );


    if (
        storedCourse &&
        storedUnitTitle
    ) {

        console.log(
            "📦 Loading quiz from localStorage..."
        );


        await window.loadQuiz(
            Number(storedCourse),
            storedUnit
                ? Number(storedUnit)
                : null,
            storedUnitTitle
        );

        return;

    }


    const quizArea = getQuizArea();


    if (quizArea) {

        quizArea.innerHTML = `

            <div class="quiz-empty">

                <h2>
                    📝 Select a Unit
                </h2>

                <p>
                    Please return to the course page
                    and select a unit to begin the quiz.
                </p>

            </div>

        `;

    }

}


// ============================================================
// START
// ============================================================

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


console.log(
    "✅ Supabase quiz engine ready."
);
