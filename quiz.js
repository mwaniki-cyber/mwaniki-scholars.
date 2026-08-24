import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS - SUPABASE QUIZ ENGINE
// =====================================================

console.log("📝 Mwaniki Scholars Supabase Quiz Engine Loaded");


// =====================================================
// QUIZ AREA
// =====================================================

function getQuizArea() {

    const quizArea =
        document.getElementById("quizArea");

    if (!quizArea) {

        console.error(
            "❌ quizArea was not found"
        );

        return null;
    }

    return quizArea;
}


// =====================================================
// LOAD QUIZ
// =====================================================

window.loadQuiz = async function(unitId, unitTitle) {

    console.log(
        "📝 Loading quiz:",
        unitTitle,
        unitId
    );

    const quizArea = getQuizArea();

    if (!quizArea) return;

    quizArea.innerHTML = `
        <div style="
            padding:20px;
            background:#eef7fb;
            border-radius:12px;
        ">
            ⏳ Loading quiz questions...
        </div>
    `;


    try {

        const {
            data,
            error
        } = await supabase
            .from("quiz_questions")
            .select("*")
            .eq("unit_id", unitId)
            .order("id", {
                ascending:true
            });


        if (error) {

            console.error(
                "❌ QUIZ LOAD ERROR:",
                error
            );

            quizArea.innerHTML = `
                <div style="
                    padding:20px;
                    background:#fff0f0;
                    color:#b00020;
                    border-radius:12px;
                ">

                    <h3>
                        ❌ Failed to load quiz
                    </h3>

                    <p>
                        ${escapeHTML(error.message)}
                    </p>

                </div>
            `;

            return;
        }


        console.log(
            "📝 Quiz questions loaded:",
            data
        );


        if (!data || data.length === 0) {

            quizArea.innerHTML = `
                <div style="
                    padding:20px;
                    background:#fff8e6;
                    border-radius:12px;
                ">

                    <h3>
                        📝 No quiz available yet
                    </h3>

                    <p>
                        No questions have been added
                        for <strong>
                        ${escapeHTML(unitTitle)}
                        </strong>.
                    </p>

                </div>
            `;

            return;
        }


        renderQuiz(
            data,
            unitId,
            unitTitle
        );

    }

    catch(error) {

        console.error(
            "❌ Unexpected quiz error:",
            error
        );

        quizArea.innerHTML = `
            <div style="
                padding:20px;
                background:#fff0f0;
                color:#b00020;
                border-radius:12px;
            ">

                ❌ ${escapeHTML(error.message)}

            </div>
        `;

    }

};


// =====================================================
// RENDER QUIZ
// =====================================================

function renderQuiz(
    questions,
    unitId,
    unitTitle
) {

    const quizArea =
        getQuizArea();

    if (!quizArea) return;


    let html = `

        <div class="quiz-container">

            <h2>
                📝 ${escapeHTML(unitTitle)}
            </h2>

            <p>
                ${questions.length}
                question${questions.length === 1 ? "" : "s"}
            </p>

            <form id="quizForm">

    `;


    questions.forEach(
        (q, index) => {

            html += `

                <div
                    class="quiz-question"
                    style="
                        background:#ffffff;
                        padding:20px;
                        margin:15px 0;
                        border-radius:14px;
                        border:1px solid #d9edf2;
                    "
                >

                    <h3>
                        ${index + 1}.
                        ${escapeHTML(q.question)}
                    </h3>

                    <label>
                        <input
                            type="radio"
                            name="question_${q.id}"
                            value="A"
                        >
                        A. ${escapeHTML(q.option_a)}
                    </label>

                    <br>

                    <label>
                        <input
                            type="radio"
                            name="question_${q.id}"
                            value="B"
                        >
                        B. ${escapeHTML(q.option_b)}
                    </label>

                    <br>

                    <label>
                        <input
                            type="radio"
                            name="question_${q.id}"
                            value="C"
                        >
                        C. ${escapeHTML(q.option_c)}
                    </label>

                    <br>

                    <label>
                        <input
                            type="radio"
                            name="question_${q.id}"
                            value="D"
                        >
                        D. ${escapeHTML(q.option_d)}
                    </label>

                </div>

            `;

        }
    );


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


    const submitButton =
        document.getElementById(
            "submitSupabaseQuiz"
        );


    if (submitButton) {

        submitButton.addEventListener(
            "click",
            () => {

                calculateQuiz(
                    questions,
                    unitId,
                    unitTitle
                );

            }
        );

    }

}


// =====================================================
// CALCULATE QUIZ
// =====================================================

function calculateQuiz(
    questions,
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
            selected.value ===
            q.correct_answer
        ) {

            score++;

        }

    });


    const total =
        questions.length;


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

    }

    else if (percentage >= 70) {

        message =
            "👏 Good work!";

    }

    else if (percentage >= 50) {

        message =
            "📚 Keep studying and try again.";

    }

    else {

        message =
            "💪 Keep practicing. You can improve!";

    }


    result.innerHTML = `

        <div style="
            margin-top:20px;
            padding:25px;
            background:#eef7fb;
            border-radius:15px;
        ">

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
        unitId,
        unitTitle,
        score,
        total,
        percentage
    );

}


// =====================================================
// SAVE LOCAL PROGRESS
// =====================================================

function saveQuizProgress(
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

    }

    catch(error) {

        progress = [];

    }


    progress.push({

        unitId:unitId,

        unit:unitTitle,

        score:score,

        total:total,

        percentage:percentage,

        date:
            new Date()
                .toLocaleDateString()

    });


    localStorage.setItem(
        "mwanikiQuizProgress",
        JSON.stringify(progress)
    );


    console.log(
        "📊 Quiz progress saved"
    );

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");

}


// =====================================================
// INITIALIZE
// =====================================================

console.log(
    "✅ Quiz engine ready"
);