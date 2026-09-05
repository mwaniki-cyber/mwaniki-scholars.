import { supabase } from "./supabase.js";

console.log("📝 Mwaniki Scholars Supabase Quiz Engine Loaded");

// =====================================================
// GET QUIZ AREA
// =====================================================

function getQuizArea() {
    const quizArea = document.getElementById("quizArea");

    if (!quizArea) {
        console.error("❌ #quizArea was not found in quiz.html");
        return null;
    }

    return quizArea;
}

// =====================================================
// ESCAPE HTML
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
// LOAD QUIZ FROM SUPABASE
// =====================================================

async function loadQuiz(courseId, unitId, unitTitle = "") {

    const quizArea = getQuizArea();

    if (!quizArea) {
        return;
    }

    console.log("======================================");
    console.log("📝 LOADING SUPABASE QUIZ");
    console.log("Course ID:", courseId);
    console.log("Unit ID:", unitId);
    console.log("Unit:", unitTitle);
    console.log("======================================");

    quizArea.innerHTML = `
        <div class="loading">
            📝 Loading quiz from Supabase...
        </div>
    `;

    // -------------------------------------------------
    // VALIDATE IDs
    // -------------------------------------------------

    const activeCourseId = Number(courseId);
    const activeUnitId = Number(unitId);

    if (!Number.isInteger(activeCourseId) || !Number.isInteger(activeUnitId)) {

        console.error("❌ Invalid course/unit ID");

        quizArea.innerHTML = `
            <div class="quiz-error">
                <h2>❌ Quiz could not be loaded</h2>
                <p>Invalid course or unit information.</p>
                <button onclick="history.back()">← Back</button>
            </div>
        `;

        return;
    }

    try {

        // -------------------------------------------------
        // SUPABASE FETCH
        // -------------------------------------------------

        console.log("🔎 Querying public.quiz_questions...");

        const { data, error } = await supabase
            .from("quiz_questions")
            .select(`
                id,
                course_id,
                unit_id,
                question,
                option_a,
                option_b,
                option_c,
                option_d,
                correct_answer
            `)
            .eq("course_id", activeCourseId)
            .eq("unit_id", activeUnitId)
            .order("id", { ascending: true });

        // -------------------------------------------------
        // SUPABASE ERROR
        // -------------------------------------------------

        if (error) {

            console.error("❌ Supabase quiz error:", error);

            quizArea.innerHTML = `
                <div class="quiz-error">

                    <h2>❌ Failed to load quiz</h2>

                    <p>
                        Supabase returned an error while loading
                        the quiz questions.
                    </p>

                    <pre>${escapeHTML(error.message)}</pre>

                    <button onclick="location.reload()">
                        🔄 Try Again
                    </button>

                </div>
            `;

            return;
        }

        // -------------------------------------------------
        // NO QUESTIONS
        // -------------------------------------------------

        if (!data || data.length === 0) {

            console.error(
                "❌ No questions found for:",
                activeCourseId,
                activeUnitId
            );

            quizArea.innerHTML = `
                <div class="quiz-error">

                    <h2>⚠️ No Quiz Questions Found</h2>

                    <p>
                        No questions were found in Supabase
                        for this course and unit.
                    </p>

                    <p>
                        Course ID: <strong>${activeCourseId}</strong>
                    </p>

                    <p>
                        Unit ID: <strong>${activeUnitId}</strong>
                    </p>

                    <button onclick="history.back()">
                        ← Back to Unit
                    </button>

                </div>
            `;

            return;
        }

        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        console.log("✅ Quiz questions returned");
        console.log("Number of questions:", data.length);

        renderQuiz(
            data,
            activeCourseId,
            activeUnitId,
            unitTitle
        );

    } catch (err) {

        console.error("❌ Unexpected quiz error:", err);

        quizArea.innerHTML = `
            <div class="quiz-error">

                <h2>❌ Quiz Loading Error</h2>

                <p>${escapeHTML(err.message)}</p>

                <button onclick="location.reload()">
                    🔄 Try Again
                </button>

            </div>
        `;
    }
}

// =====================================================
// RENDER QUIZ
// =====================================================

function renderQuiz(
    questions,
    courseId,
    unitId,
    unitTitle
) {

    const quizArea = getQuizArea();

    if (!quizArea) {
        return;
    }

    let html = `

        <div class="quiz-container">

            <div class="quiz-header">

                <button
                    type="button"
                    onclick="history.back()"
                >
                    ← Back
                </button>

                <h1>
                    📝 ${escapeHTML(unitTitle || "Unit Quiz")}
                </h1>

                <p>
                    ${questions.length} questions
                </p>

            </div>

            <form id="quizForm">

    `;

    questions.forEach((quiz, index) => {

        html += `

            <div
                class="quiz-question"
                data-question-id="${quiz.id}"
            >

                <h3>
                    ${index + 1}.
                    ${escapeHTML(quiz.question)}
                </h3>

                <label>
                    <input
                        type="radio"
                        name="question_${quiz.id}"
                        value="A"
                        required
                    >
                    A. ${escapeHTML(quiz.option_a)}
                </label>

                <label>
                    <input
                        type="radio"
                        name="question_${quiz.id}"
                        value="B"
                    >
                    B. ${escapeHTML(quiz.option_b)}
                </label>

                <label>
                    <input
                        type="radio"
                        name="question_${quiz.id}"
                        value="C"
                    >
                    C. ${escapeHTML(quiz.option_c)}
                </label>

                <label>
                    <input
                        type="radio"
                        name="question_${quiz.id}"
                        value="D"
                    >
                    D. ${escapeHTML(quiz.option_d)}
                </label>

            </div>

        `;
    });

    html += `

                <button
                    type="submit"
                    class="submit-quiz-btn"
                >
                    ✅ Submit Quiz
                </button>

            </form>

            <div id="quizResult"></div>

        </div>

    `;

    quizArea.innerHTML = html;

    // -------------------------------------------------
    // SUBMIT HANDLER
    // -------------------------------------------------

    const quizForm = document.getElementById("quizForm");

    if (quizForm) {

        quizForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                calculateResult(
                    questions,
                    courseId,
                    unitId,
                    unitTitle
                );

            }
        );

    }
}

// =====================================================
// CALCULATE RESULT
// =====================================================

function calculateResult(
    questions,
    courseId,
    unitId,
    unitTitle
) {

    let score = 0;

    questions.forEach((quiz) => {

        const selected = document.querySelector(
            `input[name="question_${quiz.id}"]:checked`
        );

        if (!selected) {
            return;
        }

        const userAnswer =
            String(selected.value)
                .trim()
                .toUpperCase();

        const correctAnswer =
            String(quiz.correct_answer)
                .trim()
                .toUpperCase();

        if (userAnswer === correctAnswer) {
            score++;
        }
    });

    const total = questions.length;

    const percentage =
        total > 0
            ? Math.round((score / total) * 100)
            : 0;

    console.log("📊 Quiz Result");
    console.log("Score:", score);
    console.log("Total:", total);
    console.log("Percentage:", percentage);

    // -------------------------------------------------
    // SAVE PROGRESS
    // -------------------------------------------------

    try {

        const progress =
            JSON.parse(
                localStorage.getItem(
                    "mwanikiQuizProgress"
                )
            ) || {};

        progress[`${courseId}_${unitId}`] = {
            courseId,
            unitId,
            unitTitle,
            score,
            total,
            percentage,
            completedAt: new Date().toISOString()
        };

        localStorage.setItem(
            "mwanikiQuizProgress",
            JSON.stringify(progress)
        );

    } catch (err) {

        console.warn(
            "⚠️ Could not save quiz progress:",
            err
        );

    }

    // -------------------------------------------------
    // SHOW RESULT
    // -------------------------------------------------

    const resultArea =
        document.getElementById("quizResult");

    if (!resultArea) {
        return;
    }

    resultArea.innerHTML = `

        <div class="quiz-result">

            <h2>🎉 Quiz Complete</h2>

            <p>
                Score:
                <strong>
                    ${score} / ${total}
                </strong>
            </p>

            <p>
                Percentage:
                <strong>
                    ${percentage}%
                </strong>
            </p>

            <button
                type="button"
                onclick="location.reload()"
            >
                🔄 Retry Quiz
            </button>

            <button
                type="button"
                onclick="history.back()"
            >
                ← Back to Unit
            </button>

        </div>

    `;
}

// =====================================================
// EXPOSE FUNCTION
// =====================================================

window.loadQuiz = loadQuiz;

// =====================================================
// INITIALIZE FROM URL
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "🚀 Initializing Supabase Quiz Page..."
        );

        const params =
            new URLSearchParams(
                window.location.search
            );

        const courseId =
            params.get("course");

        const unitId =
            params.get("unit_id");

        const unitTitle =
            params.get("unit") || "";

        console.log(
            "URL Course ID:",
            courseId
        );

        console.log(
            "URL Unit ID:",
            unitId
        );

        console.log(
            "URL Unit Title:",
            unitTitle
        );

        if (!courseId || !unitId) {

            console.error(
                "❌ Missing course or unit ID in URL"
            );

            const quizArea = getQuizArea();

            if (quizArea) {

                quizArea.innerHTML = `

                    <div class="quiz-error">

                        <h2>❌ Quiz Information Missing</h2>

                        <p>
                            The course or unit ID was not
                            supplied to the quiz page.
                        </p>

                        <button
                            onclick="history.back()"
                        >
                            ← Back
                        </button>

                    </div>

                `;

            }

            return;
        }

        loadQuiz(
            courseId,
            unitId,
            unitTitle
        );

    }
);
