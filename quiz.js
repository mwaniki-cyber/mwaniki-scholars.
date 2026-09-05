import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS - SUPABASE QUIZ ENGINE
// =====================================================

console.log("📝 Mwaniki Scholars Supabase Quiz Engine Loaded");

let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let currentCourseId = null;
let currentUnitId = null;
let currentUnitTitle = "";


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
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =====================================================
// LOAD QUIZ
// =====================================================

window.loadQuiz = async function (courseId, unitId, unitTitle = "") {

    console.log("📝 Loading quiz...");
    console.log("Course ID:", courseId);
    console.log("Unit ID:", unitId);
    console.log("Unit:", unitTitle);

    currentCourseId = Number(courseId);
    currentUnitId = Number(unitId);
    currentUnitTitle = unitTitle || "";

    currentQuestions = [];
    currentQuestionIndex = 0;
    userAnswers = {};

    const quizArea = getQuizArea();

    if (!quizArea) return;

    quizArea.innerHTML = `
        <div class="quiz-loading">
            <h2>📝 Loading Quiz...</h2>
            <p>Please wait.</p>
        </div>
    `;

    try {

        // -------------------------------------------------
        // IMPORTANT:
        // QUIZZES COME DIRECTLY FROM SUPABASE
        // -------------------------------------------------

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
            .eq("course_id", currentCourseId)
            .eq("unit_id", currentUnitId)
            .order("id", { ascending: true });

        if (error) {
            console.error("❌ Quiz query error:", error);
            throw error;
        }

        console.log("✅ Quiz questions loaded:", data);

        if (!data || data.length === 0) {

            quizArea.innerHTML = `
                <div class="quiz-empty">
                    <h2>📝 No Quiz Available</h2>

                    <p>
                        There are currently no quiz questions for:
                    </p>

                    <h3>${escapeHTML(currentUnitTitle)}</h3>

                    <button onclick="goBackToCourse()">
                        ← Back to Course
                    </button>
                </div>
            `;

            return;
        }

        currentQuestions = data;

        renderQuiz();

    } catch (error) {

        console.error("❌ Failed to load quiz:", error);

        quizArea.innerHTML = `
            <div class="quiz-error">

                <h2>⚠️ Quiz Loading Error</h2>

                <p>
                    We could not load this quiz from Supabase.
                </p>

                <p class="error-message">
                    ${escapeHTML(error.message)}
                </p>

                <button onclick="goBackToCourse()">
                    ← Back to Course
                </button>

            </div>
        `;
    }
};


// =====================================================
// RENDER QUIZ
// =====================================================

function renderQuiz() {

    const quizArea = getQuizArea();

    if (!quizArea) return;

    const question = currentQuestions[currentQuestionIndex];

    if (!question) {
        showResults();
        return;
    }

    const total = currentQuestions.length;
    const number = currentQuestionIndex + 1;

    const selectedAnswer = userAnswers[question.id] || "";

    quizArea.innerHTML = `

        <div class="quiz-container">

            <div class="quiz-header">

                <h2>📝 ${escapeHTML(currentUnitTitle)}</h2>

                <div class="quiz-progress">
                    Question ${number} of ${total}
                </div>

            </div>


            <div class="quiz-question">

                <h3>
                    ${number}. ${escapeHTML(question.question)}
                </h3>


                <div class="quiz-options">

                    ${createOption(question, "A", question.option_a, selectedAnswer)}

                    ${createOption(question, "B", question.option_b, selectedAnswer)}

                    ${createOption(question, "C", question.option_c, selectedAnswer)}

                    ${createOption(question, "D", question.option_d, selectedAnswer)}

                </div>

            </div>


            <div class="quiz-navigation">

                ${
                    currentQuestionIndex > 0
                        ? `<button onclick="previousQuestion()">← Previous</button>`
                        : ""
                }


                ${
                    currentQuestionIndex < total - 1
                        ? `<button onclick="nextQuestion()">Next →</button>`
                        : `<button onclick="finishQuiz()">Finish Quiz</button>`
                }

            </div>

        </div>
    `;
}


// =====================================================
// CREATE OPTION
// =====================================================

function createOption(question, letter, text, selectedAnswer) {

    const selected =
        selectedAnswer.toUpperCase() === letter
            ? "selected"
            : "";

    return `

        <label class="quiz-option ${selected}">

            <input
                type="radio"
                name="question-${question.id}"
                value="${letter}"
                ${selected ? "checked" : ""}
                onchange="selectAnswer(${question.id}, '${letter}')"
            >

            <span class="option-letter">
                ${letter}
            </span>

            <span class="option-text">
                ${escapeHTML(text)}
            </span>

        </label>

    `;
}


// =====================================================
// SELECT ANSWER
// =====================================================

window.selectAnswer = function(questionId, answer) {

    userAnswers[questionId] = answer;

    console.log(
        `Answer selected: Question ${questionId} = ${answer}`
    );

    renderQuiz();
};


// =====================================================
// NEXT QUESTION
// =====================================================

window.nextQuestion = function() {

    if (currentQuestionIndex < currentQuestions.length - 1) {

        currentQuestionIndex++;

        renderQuiz();
    }
};


// =====================================================
// PREVIOUS QUESTION
// =====================================================

window.previousQuestion = function() {

    if (currentQuestionIndex > 0) {

        currentQuestionIndex--;

        renderQuiz();
    }
};


// =====================================================
// FINISH QUIZ
// =====================================================

window.finishQuiz = function() {

    let score = 0;

    currentQuestions.forEach(question => {

        const answer = userAnswers[question.id];

        if (
            answer &&
            answer.toUpperCase() ===
            String(question.correct_answer).toUpperCase()
        ) {
            score++;
        }

    });

    showResults(score);
};


// =====================================================
// SHOW RESULTS
// =====================================================

function showResults(score = 0) {

    const quizArea = getQuizArea();

    if (!quizArea) return;

    const total = currentQuestions.length;

    const percentage =
        total > 0
            ? Math.round((score / total) * 100)
            : 0;

    let message = "";

    if (percentage >= 80) {
        message = "🎉 Excellent work!";
    } else if (percentage >= 60) {
        message = "👏 Good work!";
    } else if (percentage >= 50) {
        message = "👍 Keep practicing!";
    } else {
        message = "📚 Review the notes and try again.";
    }

    quizArea.innerHTML = `

        <div class="quiz-results">

            <h2>🎯 Quiz Complete</h2>

            <h3>${escapeHTML(currentUnitTitle)}</h3>

            <div class="score">

                <strong>
                    ${score} / ${total}
                </strong>

                <span>
                    ${percentage}%
                </span>

            </div>

            <p>
                ${message}
            </p>

            <div class="result-actions">

                <button onclick="restartQuiz()">
                    🔄 Try Again
                </button>

                <button onclick="goBackToCourse()">
                    ← Back to Course
                </button>

            </div>

        </div>
    `;
}


// =====================================================
// RESTART QUIZ
// =====================================================

window.restartQuiz = function() {

    currentQuestionIndex = 0;
    userAnswers = {};

    renderQuiz();
};


// =====================================================
// BACK TO COURSE
// =====================================================

window.goBackToCourse = function() {

    window.location.href = "course.html";
};


// =====================================================
// AUTO INITIALIZATION
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("✅ Quiz engine ready");

    const params = new URLSearchParams(window.location.search);

    const courseId =
        params.get("course") ||
        params.get("course_id");

    const unitId =
        params.get("unit") ||
        params.get("unit_id");

    const unitTitle =
        params.get("title") ||
        localStorage.getItem("selectedUnitTitle") ||
        "Quiz";

    if (courseId && unitId) {

        console.log(
            "🚀 URL quiz detected:",
            courseId,
            unitId
        );

        window.loadQuiz(
            Number(courseId),
            Number(unitId),
            unitTitle
        );
    }

});
