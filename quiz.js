// ======================================
// MWANIKI SCHOLARS QUIZ ENGINE
// ======================================

const quizQuestions = {

    "Anatomy Unit 1": [

        {
            question: "What is the study of body structures called?",
            options: [
                "Physiology",
                "Anatomy",
                "Pharmacology",
                "Pathology"
            ],
            answer: "Anatomy"
        },

        {
            question: "The basic structural unit of the human body is:",
            options: [
                "Organ",
                "Tissue",
                "Cell",
                "System"
            ],
            answer: "Cell"
        },

        {
            question: "The anatomical position describes the body:",
            options: [
                "Standing upright facing forward",
                "Sitting down",
                "Lying down",
                "Running"
            ],
            answer: "Standing upright facing forward"
        }

    ],


    "Physiology Unit 1": [

        {
            question: "The process of maintaining internal balance is called:",
            options: [
                "Homeostasis",
                "Metabolism",
                "Respiration",
                "Digestion"
            ],
            answer: "Homeostasis"
        },

        {
            question: "The powerhouse of the cell is:",
            options: [
                "Nucleus",
                "Mitochondria",
                "Ribosome",
                "Golgi body"
            ],
            answer: "Mitochondria"
        }

    ],


    "Microbiology Unit 1": [

        {
            question: "Microbiology is the study of:",
            options: [
                "Human bones",
                "Microorganisms",
                "Drugs",
                "Organs"
            ],
            answer: "Microorganisms"
        },

        {
            question: "Bacteria are classified as:",
            options: [
                "Prokaryotes",
                "Eukaryotes",
                "Viruses",
                "Fungi"
            ],
            answer: "Prokaryotes"
        }

    ]

};


// ======================================
// OPEN QUIZ
// ======================================

window.openQuiz = function(unitName) {

    const quizArea =
        document.getElementById("quizArea");


    if (!quizArea) {

        console.error(
            "quizArea element not found"
        );

        return;
    }


    const questions =
        quizQuestions[unitName];


    if (!questions) {

        quizArea.innerHTML = `
            <p>
                ⚠️ No quiz available for
                <strong>${unitName}</strong>.
            </p>
        `;

        return;
    }


    let html = `
        <div class="quiz-container">

            <h3>
                📝 ${unitName}
            </h3>

            <form id="quizForm">
    `;


    questions.forEach((q, index) => {

        html += `

            <div class="quiz-question">

                <p>
                    <strong>
                        ${index + 1}. ${q.question}
                    </strong>
                </p>

        `;


        q.options.forEach(option => {

            html += `

                <label
                    style="
                    display:block;
                    margin:8px 0;
                    cursor:pointer;
                    "
                >

                    <input
                        type="radio"
                        name="q${index}"
                        value="${option}"
                    >

                    ${option}

                </label>

            `;

        });


        html += `
            </div>
        `;

    });


    html += `

                <button
                    type="button"
                    id="submitQuiz"
                >
                    ✅ Submit Quiz
                </button>

            </form>

            <div id="quizResult"></div>

        </div>
    `;


    quizArea.innerHTML = html;


    const submitButton =
        document.getElementById("submitQuiz");


    submitButton.addEventListener(
        "click",
        function() {

            let score = 0;


            questions.forEach(
                (q, index) => {

                    const selected =
                        document.querySelector(
                            `input[name="q${index}"]:checked`
                        );


                    if (
                        selected &&
                        selected.value === q.answer
                    ) {

                        score++;

                    }

                }
            );


            const percentage =
                Math.round(
                    (score / questions.length) * 100
                );


            const result =
                document.getElementById(
                    "quizResult"
                );


            result.innerHTML = `

                <div
                    style="
                    margin-top:20px;
                    padding:20px;
                    border-radius:12px;
                    background:#eef7fb;
                    "
                >

                    <h3>
                        🎯 Quiz Result
                    </h3>

                    <p>
                        Score:
                        <strong>
                            ${score}/${questions.length}
                        </strong>
                    </p>

                    <p>
                        ${percentage}%
                    </p>

                    ${
                        percentage >= 70
                        ? "🎉 Excellent work!"
                        : "📚 Keep studying and try again!"
                    }

                </div>

            `;


            saveProgress(
                unitName,
                score,
                questions.length
            );


            updateProgressDisplay();

        }
    );

};


// ======================================
// SAVE PROGRESS
// ======================================

function saveProgress(
    unitName,
    score,
    total
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

        unit: unitName,

        score: score,

        total: total,

        percentage:
            Math.round(
                (score / total) * 100
            ),

        date:
            new Date().toLocaleDateString()

    });


    localStorage.setItem(
        "mwanikiQuizProgress",
        JSON.stringify(progress)
    );


    console.log(
        "📊 Quiz progress saved"
    );

}


// ======================================
// UPDATE PROGRESS DISPLAY
// ======================================

function updateProgressDisplay() {

    const progressBox =
        document.getElementById(
            "progress"
        );


    if (!progressBox) {
        return;
    }


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


    if (
        progress.length === 0
    ) {

        progressBox.innerHTML =
            "0%";

        return;

    }


    let totalScore = 0;
    let totalQuestions = 0;


    progress.forEach(item => {

        totalScore +=
            Number(item.score) || 0;

        totalQuestions +=
            Number(item.total) || 0;

    });


    const percentage =
        totalQuestions > 0
        ? Math.round(
            (totalScore /
            totalQuestions) * 100
        )
        : 0;


    progressBox.innerHTML =
        percentage + "%";

}


// ======================================
// INITIALIZE
// ======================================

updateProgressDisplay();


console.log(
    "📝 Mwaniki Scholars Quiz Engine Loaded"
);