import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS
// SUPABASE QUIZ ENGINE
// =====================================================

console.log("📝 Mwaniki Scholars Supabase Quiz Engine Loaded");

// =====================================================
// QUIZ AREA
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
// NORMALIZE TEXT
// =====================================================

function normalizeText(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

// =====================================================
// GET UNIT TITLE FROM UNIT ID
// =====================================================

async function getUnitTitle(unitId) {

    if (!unitId) {
        return "";
    }

    const numericUnitId = Number(unitId);

    if (!Number.isInteger(numericUnitId)) {
        return "";
    }

    console.log(
        "🔎 Looking up unit title for unit ID:",
        numericUnitId
    );

    const { data, error } = await supabase
        .from("units")
        .select(`
            id,
            course_id,
            title
        `)
        .eq("id", numericUnitId)
        .maybeSingle();

    if (error) {

        console.error(
            "❌ Unable to retrieve unit:",
            error
        );

        return "";
    }

    if (!data) {

        console.warn(
            "⚠️ No unit found for unit ID:",
            numericUnitId
        );

        return "";
    }

    console.log(
        "✅ Unit found:",
        data.title
    );

    return data.title || "";
}

// =====================================================
// LOAD QUIZ FROM SUPABASE
// =====================================================

async function loadQuiz(courseId, unitId, unitTitle) {

    const quizArea = getQuizArea();

    if (!quizArea) {
        return;
    }

    const activeCourseId = Number(courseId);
    const activeUnitId = Number(unitId);

    console.log("=================================");
    console.log("📝 LOADING MWANIKI SCHOLARS QUIZ");
    console.log("Course ID:", activeCourseId);
    console.log("Unit ID:", activeUnitId);
    console.log("Unit from URL:", unitTitle);
    console.log("=================================");

    // =================================================
    // VALIDATE COURSE ID
    // =================================================

    if (!Number.isInteger(activeCourseId)) {

        console.error(
            "❌ Invalid course ID:",
            courseId
        );

        quizArea.innerHTML = `
            <div class="quiz-error">

                <h2>
                    ❌ Quiz Information Missing
                </h2>

                <p>
                    The selected course could not be identified.
                </p>

            </div>
        `;

        return;
    }

    // =================================================
    // RESOLVE UNIT TITLE
    // =================================================

    let activeUnitTitle = String(
        unitTitle || ""
    ).trim();

    /*
     * The quizzes table does NOT contain unit_id.
     *
     * It contains:
     *
     * course_id
     * unit
     *
     * Therefore we need the actual unit title
     * in order to find the questions.
     */

    if (!activeUnitTitle && Number.isInteger(activeUnitId)) {

        activeUnitTitle = await getUnitTitle(
            activeUnitId
        );
    }

    console.log(
        "📚 Resolved unit title:",
        activeUnitTitle
    );

    // =================================================
    // VALIDATE UNIT
    // =================================================

    if (!activeUnitTitle) {

        console.error(
            "❌ Unit title could not be determined."
        );

        quizArea.innerHTML = `
            <div class="quiz-error">

                <h2>
                    ❌ Unit Information Missing
                </h2>

                <p>
                    The selected unit could not be identified.
                </p>

                <p>
                    Course ID:
                    <strong>
                        ${escapeHTML(activeCourseId)}
                    </strong>
                </p>

                <p>
                    Unit ID:
                    <strong>
                        ${escapeHTML(activeUnitId)}
                    </strong>
                </p>

            </div>
        `;

        return;
    }

    // =================================================
    // LOADING SCREEN
    // =================================================

    quizArea.innerHTML = `
        <div class="quiz-loading">

            <div class="quiz-loading-icon">
                📝
            </div>

            <h2>
                Loading Quiz...
            </h2>

            <p>
                Loading questions for
                <strong>
                    ${escapeHTML(activeUnitTitle)}
                </strong>
            </p>

        </div>
    `;

    // =================================================
    // LOAD QUESTIONS
    // =================================================

    /*
     * IMPORTANT:
     *
     * The real database table is "quizzes".
     *
     * The real columns are:
     *
     * id
     * course_id
     * question
     * option_a
     * option_b
     * option_c
     * option_d
     * correct_answer
     * created_at
     * course
     * unit
     *
     * There is NO unit_id column.
     *
     * We therefore load quizzes belonging to the
     * selected course and then match the unit locally.
     */

    const {
        data,
        error
    } = await supabase
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
        .order("id", {
            ascending: true
        });

    // =================================================
    // DATABASE ERROR
    // =================================================

    if (error) {

        console.error(
            "❌ Supabase quiz loading error:",
            error
        );

        quizArea.innerHTML = `
            <div class="quiz-error">

                <h2>
                    ❌ Unable to Load Quiz
                </h2>

                <p>
                    ${escapeHTML(error.message)}
                </p>

                <div class="quiz-debug-info">

                    <p>
                        Course ID:
                        <strong>
                            ${escapeHTML(activeCourseId)}
                        </strong>
                    </p>

                    <p>
                        Unit ID:
                        <strong>
                            ${escapeHTML(activeUnitId)}
                        </strong>
                    </p>

                    <p>
                        Unit:
                        <strong>
                            ${escapeHTML(activeUnitTitle)}
                        </strong>
                    </p>

                    <p>
                        Database table:
                        <strong>
                            quizzes
                        </strong>
                    </p>

                </div>

            </div>
        `;

        return;
    }

    // =================================================
    // NO COURSE QUESTIONS
    // =================================================

    if (!Array.isArray(data) || data.length === 0) {

        console.warn(
            "⚠️ No quizzes found for course:",
            activeCourseId
        );

        quizArea.innerHTML = `
            <div class="quiz-empty">

                <h2>
                    📝 No Questions Found
                </h2>

                <p>
                    There are currently no quiz questions
                    for this course.
                </p>

                <div class="quiz-debug-info">

                    <p>
                        Course ID:
                        <strong>
                            ${escapeHTML(activeCourseId)}
                        </strong>
                    </p>

                    <p>
                        Unit:
                        <strong>
                            ${escapeHTML(activeUnitTitle)}
                        </strong>
                    </p>

                </div>

            </div>
        `;

        return;
    }

    console.log(
        `📚 ${data.length} quiz records loaded for course ${activeCourseId}`
    );

    // =================================================
    // MATCH UNIT
    // =================================================

    const targetUnit = normalizeText(
        activeUnitTitle
    );

    const unitQuestions = data.filter(
        (quiz) => {

            const quizUnit = normalizeText(
                quiz.unit
            );

            return quizUnit === targetUnit;
        }
    );

    console.log(
        "🎯 Requested unit:",
        activeUnitTitle
    );

    console.log(
        "🎯 Matching database unit:",
        targetUnit
    );

    console.log(
        `✅ ${unitQuestions.length} questions matched the selected unit`
    );

    // =================================================
    // NO QUESTIONS FOR THIS UNIT
    // =================================================

    if (unitQuestions.length === 0) {

        console.warn(
            "⚠️ Course has quizzes, but none match this unit."
        );

        /*
         * Show available units in the console.
         * This is extremely useful for diagnosing
         * spelling/capitalization differences.
         */

        const availableUnits = [
            ...new Set(
                data
                    .map(
                        (quiz) =>
                            String(
                                quiz.unit || ""
                            ).trim()
                    )
                    .filter(Boolean)
            )
        ];

        console.log(
            "📚 Available quiz units for this course:",
            availableUnits
        );

        quizArea.innerHTML = `
            <div class="quiz-empty">

                <h2>
                    📝 No Questions Found
                </h2>

                <p>
                    This course contains quizzes, but no
                    questions were found for:
                </p>

                <h3>
                    ${escapeHTML(activeUnitTitle)}
                </h3>

                <div class="quiz-debug-info">

                    <p>
                        Course ID:
                        <strong>
                            ${escapeHTML(activeCourseId)}
                        </strong>
                    </p>

                    <p>
                        Unit ID:
                        <strong>
                            ${escapeHTML(activeUnitId)}
                        </strong>
                    </p>

                    <p>
                        Unit requested:
                        <strong>
                            ${escapeHTML(activeUnitTitle)}
                        </strong>
                    </p>

                    <p>
                        Course quiz records:
                        <strong>
                            ${data.length}
                        </strong>
                    </p>

                </div>

                <p>
                    Please return to the course and select
                    the unit again.
                </p>

            </div>
        `;

        return;
    }

    // =================================================
    // RENDER QUIZ
    // =================================================

    renderQuiz(
        unitQuestions,
        activeUnitTitle,
        activeCourseId,
        activeUnitId
    );
}

// =====================================================
// RENDER QUIZ
// =====================================================

function renderQuiz(
    questions,
    unitTitle,
    courseId,
    unitId
) {

    const quizArea = getQuizArea();

    if (!quizArea) {
        return;
    }

    const safeUnitTitle =
        unitTitle || "Quiz";

    // =================================================
    // QUIZ HEADER
    // =================================================

    let html = `
        <div class="quiz-container">

            <div class="quiz-header">

                <div class="quiz-header-icon">
                    📝
                </div>

                <div class="quiz-header-text">

                    <h1>
                        ${escapeHTML(safeUnitTitle)}
                    </h1>

                    <p>
                        ${questions.length}
                        ${questions.length === 1
                            ? "question"
                            : "questions"}
                    </p>

                </div>

            </div>

            <div class="quiz-instructions">

                <strong>
                    📌 Instructions
                </strong>

                <p>
                    Select the best answer for each question.
                    You can select only one answer per question.
                </p>

            </div>

            <form id="quizForm">

                <div class="questions-list">
    `;

    // =================================================
    // QUESTIONS
    // =================================================

    questions.forEach(
        (q, index) => {

            const questionNumber =
                index + 1;

            html += `
                <div
                    class="quiz-question"
                    data-question-id="${escapeHTML(q.id)}"
                >

                    <div class="question-number">
                        Question ${questionNumber}
                    </div>

                    <div class="question-text">
                        ${escapeHTML(q.question)}
                    </div>

                    <div class="quiz-options">

                        <label class="quiz-option">

                            <input
                                type="radio"
                                name="question_${escapeHTML(q.id)}"
                                value="A"
                            >

                            <span class="option-letter">
                                A
                            </span>

                            <span class="option-text">
                                ${escapeHTML(q.option_a)}
                            </span>

                        </label>

                        <label class="quiz-option">

                            <input
                                type="radio"
                                name="question_${escapeHTML(q.id)}"
                                value="B"
                            >

                            <span class="option-letter">
                                B
                            </span>

                            <span class="option-text">
                                ${escapeHTML(q.option_b)}
                            </span>

                        </label>

                        <label class="quiz-option">

                            <input
                                type="radio"
                                name="question_${escapeHTML(q.id)}"
                                value="C"
                            >

                            <span class="option-letter">
                                C
                            </span>

                            <span class="option-text">
                                ${escapeHTML(q.option_c)}
                            </span>

                        </label>

                        <label class="quiz-option">

                            <input
                                type="radio"
                                name="question_${escapeHTML(q.id)}"
                                value="D"
                            >

                            <span class="option-letter">
                                D
                            </span>

                            <span class="option-text">
                                ${escapeHTML(q.option_d)}
                            </span>

                        </label>

                    </div>

                </div>
            `;
        }
    );

    // =================================================
    // SUBMIT
    // =================================================

    html += `
                </div>

                <div class="quiz-submit-area">

                    <button
                        type="submit"
                        class="submit-quiz-button"
                    >
                        ✅ Submit Quiz
                    </button>

                </div>

            </form>

        </div>
    `;

    quizArea.innerHTML = html;

    // =================================================
    // FORM
    // =================================================

    const quizForm =
        document.getElementById(
            "quizForm"
        );

    if (!quizForm) {

        console.error(
            "❌ quizForm was not created."
        );

        return;
    }

    quizForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            calculateResult(
                questions,
                courseId,
                unitId,
                safeUnitTitle
            );
        }
    );

    // =================================================
    // OPTION SELECTION
    // =================================================

    const optionLabels =
        document.querySelectorAll(
            ".quiz-option"
        );

    optionLabels.forEach(
        (label) => {

            const radio =
                label.querySelector(
                    "input[type='radio']"
                );

            if (!radio) {
                return;
            }

            radio.addEventListener(
                "change",
                () => {

                    const groupName =
                        radio.name;

                    document
                        .querySelectorAll(
                            `input[name="${groupName}"]`
                        )
                        .forEach(
                            (input) => {

                                const parent =
                                    input.closest(
                                        ".quiz-option"
                                    );

                                if (parent) {

                                    parent.classList.remove(
                                        "selected"
                                    );
                                }
                            }
                        );

                    if (radio.checked) {

                        label.classList.add(
                            "selected"
                        );
                    }
                }
            );
        }
    );
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
    let answered = 0;

    const results = [];

    questions.forEach(
        (q, index) => {

            const selected =
                document.querySelector(
                    `input[name="question_${q.id}"]:checked`
                );

            const selectedAnswer =
                selected
                    ? selected.value
                    : null;

            if (selectedAnswer) {
                answered++;
            }

            const correctAnswer =
                String(
                    q.correct_answer || ""
                )
                    .trim()
                    .toUpperCase();

            const isCorrect =
                selectedAnswer ===
                correctAnswer;

            if (isCorrect) {
                score++;
            }

            results.push({
                questionNumber:
                    index + 1,

                question:
                    q.question,

                selected:
                    selectedAnswer,

                correct:
                    correctAnswer,

                isCorrect
            });
        }
    );

    // =================================================
    // SCORE
    // =================================================

    const total =
        questions.length;

    const percentage =
        total > 0
            ? Math.round(
                (score / total) * 100
            )
            : 0;

    // =================================================
    // SAVE PROGRESS
    // =================================================

    const progressKey =
        `quizProgress_${courseId}_${unitId}`;

    const progressData = {

        courseId,
        unitId,
        unitTitle,

        score,
        total,
        percentage,
        answered,

        completed: true,

        completedAt:
            new Date().toISOString()
    };

    localStorage.setItem(
        progressKey,
        JSON.stringify(
            progressData
        )
    );

    console.log(
        "📊 Quiz Result:",
        progressData
    );

    // =================================================
    // DISPLAY RESULT
    // =================================================

    displayResult(
        score,
        total,
        percentage,
        answered,
        results
    );
}

// =====================================================
// DISPLAY RESULT
// =====================================================

function displayResult(
    score,
    total,
    percentage,
    answered,
    results
) {

    const quizArea =
        getQuizArea();

    if (!quizArea) {
        return;
    }

    let message;

    if (percentage >= 80) {

        message =
            "🎉 Excellent work!";

    } else if (percentage >= 60) {

        message =
            "👍 Good work! Keep studying.";

    } else if (percentage >= 50) {

        message =
            "📚 Fair attempt. Review the notes and try again.";

    } else {

        message =
            "💪 Keep studying. You can improve!";
    }

    let reviewHTML = "";

    results.forEach(
        (result) => {

            const status =
                result.isCorrect
                    ? "correct"
                    : "incorrect";

            const icon =
                result.isCorrect
                    ? "✅"
                    : "❌";

            reviewHTML += `
                <div
                    class="answer-review ${status}"
                >

                    <div class="review-question">

                        ${icon}

                        Question
                        ${result.questionNumber}

                    </div>

                    <div class="review-text">

                        ${escapeHTML(
                            result.question
                        )}

                    </div>

                    <div class="review-answer">

                        Your answer:

                        <strong>

                            ${
                                result.selected
                                    ? escapeHTML(
                                        result.selected
                                    )
                                    : "Not answered"
                            }

                        </strong>

                    </div>

                    ${
                        !result.isCorrect
                            ? `
                                <div class="review-correct">

                                    Correct answer:

                                    <strong>
                                        ${escapeHTML(
                                            result.correct
                                        )}
                                    </strong>

                                </div>
                            `
                            : ""
                    }

                </div>
            `;
        }
    );

    quizArea.innerHTML = `
        <div class="quiz-result">

            <div class="result-icon">

                ${
                    percentage >= 50
                        ? "🎉"
                        : "📚"
                }

            </div>

            <h1>
                Quiz Completed
            </h1>

            <p class="result-message">
                ${message}
            </p>

            <div class="score-card">

                <div class="score-number">
                    ${score}/${total}
                </div>

                <div class="score-percentage">
                    ${percentage}%
                </div>

                <div class="score-details">

                    <span>
                        Answered:
                        <strong>
                            ${answered}
                        </strong>
                    </span>

                    <span>
                        Correct:
                        <strong>
                            ${score}
                        </strong>
                    </span>

                    <span>
                        Incorrect:
                        <strong>
                            ${total - score}
                        </strong>
                    </span>

                </div>

            </div>

            <div class="result-actions">

                <button
                    type="button"
                    class="retry-quiz-button"
                    id="retryQuizButton"
                >
                    🔄 Retry Quiz
                </button>

                <button
                    type="button"
                    class="back-course-button"
                    id="backCourseButton"
                >
                    ← Back to Course
                </button>

            </div>

            <div class="answer-review-container">

                <h2>
                    📋 Answer Review
                </h2>

                ${reviewHTML}

            </div>

        </div>
    `;

    // =================================================
    // RETRY
    // =================================================

    const retryButton =
        document.getElementById(
            "retryQuizButton"
        );

    if (retryButton) {

        retryButton.addEventListener(
            "click",
            () => {

                window.location.reload();

            }
        );
    }

    // =================================================
    // BACK TO COURSE
    // =================================================

    const backButton =
        document.getElementById(
            "backCourseButton"
        );

    if (backButton) {

        backButton.addEventListener(
            "click",
            () => {

                window.location.href =
                    "./course.html";

            }
        );
    }

    // =================================================
    // TOP
    // =================================================

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// =====================================================
// INITIALIZE QUIZ
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "🚀 Quiz page initializing..."
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
            "URL Unit:",
            unitTitle
        );

        // =================================================
        // COURSE REQUIRED
        // =================================================

        if (!courseId) {

            const quizArea =
                getQuizArea();

            if (quizArea) {

                quizArea.innerHTML = `
                    <div class="quiz-error">

                        <h2>
                            ❌ Quiz Information Missing
                        </h2>

                        <p>
                            Course information was not supplied.
                        </p>

                    </div>
                `;
            }

            return;
        }

        // =================================================
        // LOAD
        // =================================================

        loadQuiz(
            courseId,
            unitId,
            unitTitle
        );
    }
);

// =====================================================
// GLOBAL ACCESS
// =====================================================

window.loadQuiz = loadQuiz;

console.log(
    "✅ Mwaniki Scholars quiz engine ready."
);
