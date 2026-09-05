import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS - SUPABASE QUIZ ENGINE
// =====================================================

console.log("📝 Mwaniki Scholars Supabase Quiz Engine Loaded");

let quizQuestions = [];
let currentQuestion = 0;
let score = 0;
let selectedAnswers = {};
let quizCourseId = null;
let quizUnitId = null;
let quizUnitTitle = "";
let quizCourseName = "";


// =====================================================
// HELPERS
// =====================================================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function getQuizArea() {
    const quizArea = document.getElementById("quizArea");

    if (!quizArea) {
        console.error("❌ #quizArea was not found");
        return null;
    }

    return quizArea;
}


// =====================================================
// GET VALUES FROM URL / LOCAL STORAGE
// =====================================================

function getQuizInformation() {

    const params = new URLSearchParams(window.location.search);

    const courseFromURL = params.get("course");
    const unitIdFromURL = params.get("unit_id");
    const unitFromURL = params.get("unit");

    const courseId =
        courseFromURL ||
        localStorage.getItem("selectedCourse");

    const unitId =
        unitIdFromURL ||
        localStorage.getItem("selectedUnit");

    const unitTitle =
        unitFromURL ||
        localStorage.getItem("selectedUnitTitle");

    const courseName =
        localStorage.getItem("selectedCourseName") ||
        "";

    return {
        courseId,
        unitId,
        unitTitle,
        courseName
    };
}


// =====================================================
// LOAD COURSE NAME
// =====================================================

async function loadCourseName(courseId) {

    if (!courseId) {
        return "";
    }

    try {

        const { data, error } = await supabase
            .from("courses")
            .select("id, title")
            .eq("id", Number(courseId))
            .single();

        if (error) {
            console.warn("⚠️ Could not load course name:", error.message);
            return "";
        }

        return data?.title || "";

    } catch (error) {

        console.warn("⚠️ Course name error:", error);
        return "";
    }
}


// =====================================================
// LOAD QUIZ
// =====================================================

window.loadQuiz = async function (
    courseId,
    unitId,
    unitTitle
) {

    const quizArea = getQuizArea();

    if (!quizArea) {
        return;
    }

    quizCourseId = Number(courseId);
    quizUnitId = unitId;
    quizUnitTitle = unitTitle || "";

    console.log("📚 Loading quiz");
    console.log("Course ID:", quizCourseId);
    console.log("Unit ID:", quizUnitId);
    console.log("Unit:", quizUnitTitle);

    if (!quizCourseId) {

        quizArea.innerHTML = `
            <div class="quiz-error">
                <h2>⚠️ Course not found</h2>
                <p>No course was selected.</p>
                <button onclick="goBackToCourse()">
                    ← Back to Course
                </button>
            </div>
        `;

        return;
    }

    if (!quizUnitTitle) {

        quizArea.innerHTML = `
            <div class="quiz-error">
                <h2>⚠️ Unit not found</h2>
                <p>No unit was selected.</p>
                <button onclick="goBackToCourse()">
                    ← Back to Course
                </button>
            </div>
        `;

        return;
    }


    // -------------------------------------------------
    // LOADING
    // -------------------------------------------------

    quizArea.innerHTML = `
        <div class="quiz-loading">
            <div class="loading-spinner">⏳</div>
            <h2>Loading Quiz...</h2>
            <p>${escapeHTML(quizUnitTitle)}</p>
        </div>
    `;


    try {

        // -------------------------------------------------
        // LOAD COURSE NAME
        // -------------------------------------------------

        quizCourseName =
            await loadCourseName(quizCourseId);


        // -------------------------------------------------
        // LOAD QUESTIONS
        // -------------------------------------------------

        const { data, error } = await supabase
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
            .eq("course_id", quizCourseId)
            .eq("unit", quizUnitTitle)
            .order("id", {
                ascending: true
            });


        if (error) {

            console.error("❌ Quiz query error:", error);

            quizArea.innerHTML = `
                <div class="quiz-error">
                    <h2>❌ Failed to load quiz</h2>
                    <p>${escapeHTML(error.message)}</p>

                    <button onclick="location.reload()">
                        🔄 Try Again
                    </button>

                    <button onclick="goBackToCourse()">
                        ← Back to Course
                    </button>
                </div>
            `;

            return;
        }


        quizQuestions = data || [];

        console.log(
            `✅ ${quizQuestions.length} quiz questions loaded`
        );


        // -------------------------------------------------
        // NO QUESTIONS
        // -------------------------------------------------

        if (quizQuestions.length === 0) {

            quizArea.innerHTML = `
                <div class="quiz-empty">

                    <div style="font-size:60px;">
                        📝
                    </div>

                    <h2>No Quiz Available</h2>

                    <p>
                        There are currently no quiz questions
                        for:
                    </p>

                    <strong>
                        ${escapeHTML(quizUnitTitle)}
                    </strong>

                    <p style="margin-top:15px;">
                        Course:
                        ${escapeHTML(
                            quizCourseName || "Selected Course"
                        )}
                    </p>

                    <button onclick="goBackToCourse()">
                        ← Back to Course
                    </button>

                </div>
            `;

            return;
        }


        // -------------------------------------------------
        // RESET QUIZ
        // -------------------------------------------------

        currentQuestion = 0;
        score = 0;
        selectedAnswers = {};


        // -------------------------------------------------
        // SHOW QUIZ
        // -------------------------------------------------

        renderQuiz();

    } catch (error) {

        console.error("❌ Unexpected quiz error:", error);

        quizArea.innerHTML = `
            <div class="quiz-error">

                <h2>❌ Something went wrong</h2>

                <p>
                    ${escapeHTML(error.message)}
                </p>

                <button onclick="location.reload()">
                    🔄 Try Again
                </button>

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

    if (!quizArea) {
        return;
    }

    if (
        currentQuestion < 0 ||
        currentQuestion >= quizQuestions.length
    ) {
        showResults();
        return;
    }


    const question = quizQuestions[currentQuestion];

    const questionNumber =
        currentQuestion + 1;

    const totalQuestions =
        quizQuestions.length;


    const progress =
        Math.round(
            (questionNumber / totalQuestions) * 100
        );


    const options = [
        {
            letter: "A",
            text: question.option_a
        },
        {
            letter: "B",
            text: question.option_b
        },
        {
            letter: "C",
            text: question.option_c
        },
        {
            letter: "D",
            text: question.option_d
        }
    ];


    const previousAnswer =
        selectedAnswers[question.id];


    quizArea.innerHTML = `

        <div class="quiz-container">

            <!-- HEADER -->

            <div class="quiz-header">

                <div>

                    <h1>
                        📝 ${escapeHTML(
                            quizUnitTitle
                        )}
                    </h1>

                    <p>
                        ${escapeHTML(
                            quizCourseName ||
                            "Mwaniki Scholars"
                        )}
                    </p>

                </div>

                <div class="quiz-counter">
                    Question
                    ${questionNumber}
                    of
                    ${totalQuestions}
                </div>

            </div>


            <!-- PROGRESS -->

            <div class="quiz-progress">

                <div
                    class="quiz-progress-bar"
                    style="width:${progress}%"
                ></div>

            </div>


            <!-- QUESTION -->

            <div class="question-card">

                <div class="question-number">

                    Question ${questionNumber}

                </div>


                <h2 class="question-text">

                    ${escapeHTML(
                        question.question
                    )}

                </h2>


                <!-- OPTIONS -->

                <div class="quiz-options">

                    ${options.map(option => `

                        <button
                            type="button"
                            class="quiz-option ${
                                previousAnswer === option.letter
                                    ? "selected"
                                    : ""
                            }"
                            data-answer="${option.letter}"
                            onclick="selectAnswer(
                                ${question.id},
                                '${option.letter}'
                            )"
                        >

                            <span class="option-letter">
                                ${option.letter}
                            </span>

                            <span class="option-text">
                                ${escapeHTML(
                                    option.text
                                )}
                            </span>

                        </button>

                    `).join("")}

                </div>


                <!-- NAVIGATION -->

                <div class="quiz-navigation">

                    <button
                        type="button"
                        class="quiz-back-button"
                        onclick="previousQuizQuestion()"
                        ${currentQuestion === 0 ? "disabled" : ""}
                    >
                        ← Previous
                    </button>


                    <button
                        type="button"
                        class="quiz-next-button"
                        onclick="nextQuizQuestion()"
                    >
                        ${
                            currentQuestion ===
                            quizQuestions.length - 1
                                ? "Finish Quiz ✓"
                                : "Next →"
                        }
                    </button>

                </div>

            </div>

        </div>
    `;
}


// =====================================================
// SELECT ANSWER
// =====================================================

window.selectAnswer = function (
    questionId,
    answer
) {

    selectedAnswers[questionId] =
        String(answer).toUpperCase();


    document
        .querySelectorAll(".quiz-option")
        .forEach(button => {

            button.classList.remove("selected");

        });


    const selectedButton =
        document.querySelector(
            `.quiz-option[data-answer="${answer}"]`
        );


    if (selectedButton) {

        selectedButton.classList.add(
            "selected"
        );

    }
};


// =====================================================
// NEXT QUESTION
// =====================================================

window.nextQuizQuestion = function () {

    const question =
        quizQuestions[currentQuestion];


    if (!question) {
        return;
    }


    if (
        !selectedAnswers[question.id]
    ) {

        alert(
            "Please select an answer before continuing."
        );

        return;
    }


    if (
        selectedAnswers[question.id] ===
        String(question.correct_answer)
            .trim()
            .toUpperCase()
    ) {

        // Score is recalculated in final results,
        // so we don't increment here.

    }


    if (
        currentQuestion <
        quizQuestions.length - 1
    ) {

        currentQuestion++;

        renderQuiz();

    } else {

        showResults();

    }
};


// =====================================================
// PREVIOUS QUESTION
// =====================================================

window.previousQuizQuestion = function () {

    if (currentQuestion > 0) {

        currentQuestion--;

        renderQuiz();

    }
};


// =====================================================
// SHOW RESULTS
// =====================================================

function showResults() {

    const quizArea = getQuizArea();

    if (!quizArea) {
        return;
    }


    score = 0;


    quizQuestions.forEach(question => {

        const selected =
            selectedAnswers[question.id];

        const correct =
            String(
                question.correct_answer
            )
            .trim()
            .toUpperCase();


        if (
            selected &&
            selected === correct
        ) {

            score++;

        }

    });


    const total =
        quizQuestions.length;


    const percentage =
        total > 0
            ? Math.round(
                (score / total) * 100
            )
            : 0;


    let message = "";


    if (percentage >= 80) {

        message =
            "🎉 Excellent work!";

    } else if (percentage >= 60) {

        message =
            "👍 Good work! Keep studying.";

    } else if (percentage >= 50) {

        message =
            "📚 Keep practicing. You can improve!";

    } else {

        message =
            "💪 Don't give up. Review the notes and try again.";

    }


    quizArea.innerHTML = `

        <div class="quiz-results">

            <div class="result-icon">
                ${
                    percentage >= 80
                        ? "🏆"
                        : percentage >= 50
                            ? "🎯"
                            : "📚"
                }
            </div>


            <h1>
                Quiz Completed
            </h1>


            <h2>
                ${escapeHTML(message)}
            </h2>


            <div class="score-box">

                <div class="score-number">
                    ${score}/${total}
                </div>

                <div class="score-percentage">
                    ${percentage}%
                </div>

            </div>


            <p>
                You answered
                <strong>${score}</strong>
                out of
                <strong>${total}</strong>
                questions correctly.
            </p>


            <div class="result-buttons">

                <button
                    type="button"
                    onclick="restartQuiz()"
                >
                    🔄 Retake Quiz
                </button>


                <button
                    type="button"
                    onclick="goBackToCourse()"
                >
                    ← Back to Course
                </button>

            </div>

        </div>
    `;


    saveQuizResult(
        score,
        total,
        percentage
    );
}


// =====================================================
// RESTART QUIZ
// =====================================================

window.restartQuiz = function () {

    currentQuestion = 0;
    score = 0;
    selectedAnswers = {};

    renderQuiz();
};


// =====================================================
// SAVE LOCAL QUIZ RESULT
// =====================================================

function saveQuizResult(
    score,
    total,
    percentage
) {

    try {

        const key =
            `quizProgress_${quizCourseId}_${quizUnitId}`;

        const result = {

            courseId: quizCourseId,

            unitId: quizUnitId,

            unitTitle: quizUnitTitle,

            score,

            total,

            percentage,

            completedAt:
                new Date().toISOString()

        };


        localStorage.setItem(
            key,
            JSON.stringify(result)
        );


        console.log(
            "💾 Quiz result saved:",
            result
        );

    } catch (error) {

        console.warn(
            "⚠️ Could not save quiz result:",
            error
        );

    }
}


// =====================================================
// BACK TO COURSE
// =====================================================

window.goBackToCourse = function () {

    if (quizCourseId) {

        localStorage.setItem(
            "selectedCourse",
            String(quizCourseId)
        );

    }

    if (quizCourseName) {

        localStorage.setItem(
            "selectedCourseName",
            quizCourseName
        );

    }


    window.location.href =
        `course.html?course=${encodeURIComponent(
            quizCourseId
        )}`;
};


// =====================================================
// START QUIZ
// =====================================================

async function initializeQuiz() {

    console.log(
        "🚀 Initializing quiz..."
    );


    const information =
        getQuizInformation();


    console.log(
        "Quiz information:",
        information
    );


    if (!information.courseId) {

        const quizArea =
            getQuizArea();

        if (quizArea) {

            quizArea.innerHTML = `

                <div class="quiz-error">

                    <h2>
                        ⚠️ No Course Selected
                    </h2>

                    <p>
                        Please return to your course
                        and select a unit quiz.
                    </p>

                    <button
                        onclick="location.href='courses.html'"
                    >
                        📚 View Courses
                    </button>

                </div>

            `;

        }

        return;
    }


    if (!information.unitTitle) {

        const quizArea =
            getQuizArea();

        if (quizArea) {

            quizArea.innerHTML = `

                <div class="quiz-error">

                    <h2>
                        ⚠️ No Unit Selected
                    </h2>

                    <p>
                        Please return to the course
                        and select a unit.
                    </p>

                    <button
                        onclick="goBackToCourse()"
                    >
                        ← Back to Course
                    </button>

                </div>

            `;

        }

        return;
    }


    await window.loadQuiz(
        information.courseId,
        information.unitId,
        information.unitTitle
    );
}


// =====================================================
// RUN
// =====================================================

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeQuiz
    );

} else {

    initializeQuiz();

}


console.log(
    "✅ Quiz engine ready"
);
