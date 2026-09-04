```javascript
import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS - COURSE PAGE ENGINE
// =====================================================
// Supports:
// 1. Course information
// 2. Units
// 3. Full notes in units.notes_content
// 4. Older notes in units.notes
// 5. Uploaded notes in public.notes
// 6. Quizzes directly from public.quizzes
// 7. Quiz scoring
// =====================================================


// =====================================================
// SELECTED COURSE
// =====================================================

const courseId =
    localStorage.getItem("selectedCourse");

const courseName =
    localStorage.getItem("selectedCourseName");


// =====================================================
// PAGE ELEMENTS
// =====================================================

const courseTitle =
    document.getElementById("courseTitle");

const courseDescription =
    document.getElementById("courseDescription");

const unitsArea =
    document.getElementById("unitsArea");

const notesArea =
    document.getElementById("notesArea");

const quizArea =
    document.getElementById("quizArea");


// =====================================================
// CHECK COURSE
// =====================================================

if (!courseId) {

    console.error(
        "❌ No selected course found"
    );

    if (courseTitle) {

        courseTitle.textContent =
            "❌ No course selected";
    }

} else {

    console.log(
        "📚 Loading selected course:",
        courseId
    );

}


// =====================================================
// LOAD COURSE
// =====================================================

async function loadCourse() {

    if (!courseId) return;

    try {

        const {
            data,
            error
        } = await supabase

            .from("courses")

            .select("*")

            .eq("id", courseId)

            .single();


        if (error) {

            console.error(
                "❌ COURSE ERROR:",
                error
            );

            if (courseTitle) {

                courseTitle.textContent =
                    "❌ Failed to load course";
            }

            return;
        }


        console.log(
            "✅ Course loaded:",
            data
        );


        if (courseTitle) {

            courseTitle.textContent =
                data.title ||
                courseName ||
                "Medical Course";
        }


        if (courseDescription) {

            courseDescription.textContent =
                data.description ||
                "Medical learning course";
        }


    } catch (error) {

        console.error(
            "❌ Unexpected course error:",
            error
        );

    }

}


// =====================================================
// LOAD UNITS
// =====================================================

async function loadUnits() {

    if (!unitsArea) {

        console.error(
            "❌ unitsArea not found"
        );

        return;
    }


    unitsArea.innerHTML = `

        <p>
            ⏳ Loading units...
        </p>

    `;


    try {

        // =================================================
        // LOAD UNIT DATA
        // =================================================

        const {
            data,
            error
        } = await supabase

            .from("units")

            .select(`
                id,
                course_id,
                title,
                notes,
                notes_content,
                image,
                video_url,
                created_at
            `)

            .eq(
                "course_id",
                courseId
            )

            .order(
                "id",
                {
                    ascending: true
                }
            );


        if (error) {

            console.error(
                "❌ UNITS ERROR:",
                error
            );


            unitsArea.innerHTML = `

                <div style="
                    padding:20px;
                    background:#fff0f0;
                    color:#b00020;
                    border-radius:12px;
                ">

                    <h3>
                        ❌ Failed to load units
                    </h3>

                    <p>
                        ${escapeHTML(error.message)}
                    </p>

                </div>

            `;

            return;
        }


        console.log(
            "📖 Units loaded:",
            data
        );


        if (
            !data ||
            data.length === 0
        ) {

            unitsArea.innerHTML = `

                <div style="
                    padding:20px;
                    background:#fff8e6;
                    border-radius:12px;
                ">

                    📚 No units available for
                    this course yet.

                </div>

            `;

            return;
        }


        unitsArea.innerHTML = "";


        // =================================================
        // CREATE UNIT CARDS
        // =================================================

        data.forEach(
            (unit) => {

                const unitCard =
                    document.createElement("div");


                unitCard.className =
                    "unit-card";


                // =================================================
                // DIRECT NOTES
                // =================================================

                const directNotes =
                    getUnitNotes(unit);


                const hasDirectNotes =
                    directNotes.trim().length > 0;


                unitCard.innerHTML = `

                    <h3>
                        📖
                        ${escapeHTML(unit.title)}
                    </h3>


                    <div style="
                        margin-top:15px;
                        display:flex;
                        gap:10px;
                        flex-wrap:wrap;
                    ">


                        <!-- QUIZ BUTTON -->

                        <button
                            type="button"
                            class="start-quiz-button"
                            data-unit-id="${escapeHTML(unit.id)}"
                            data-unit-title="${escapeHTML(unit.title)}"
                        >

                            📝 Start Quiz

                        </button>


                        <!-- NOTES BUTTON -->

                        <button
                            type="button"
                            class="view-notes-button"
                            data-unit-id="${escapeHTML(unit.id)}"
                            data-unit-title="${escapeHTML(unit.title)}"
                        >

                            📄 View Notes

                        </button>


                    </div>


                    ${
                        hasDirectNotes

                        ?

                        `
                        <div style="
                            margin-top:10px;
                            color:#137333;
                            font-size:14px;
                        ">

                            ✅ Detailed notes available

                        </div>
                        `

                        :

                        `
                        <div style="
                            margin-top:10px;
                            color:#777;
                            font-size:14px;
                        ">

                            📄 Notes will load
                            from the notes library

                        </div>
                        `
                    }

                `;


                unitsArea.appendChild(
                    unitCard
                );

            }
        );


        // =================================================
        // QUIZ BUTTON EVENTS
        // =================================================

        document
            .querySelectorAll(
                ".start-quiz-button"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async function () {

                            const unitId =
                                this.dataset.unitId;


                            const unitTitle =
                                this.dataset.unitTitle;


                            console.log(
                                "📝 Starting quiz:",
                                unitTitle,
                                unitId
                            );


                            await loadUnitQuiz(
                                unitId,
                                unitTitle
                            );

                        }
                    );

                }
            );


        // =================================================
        // NOTES BUTTON EVENTS
        // =================================================

        document
            .querySelectorAll(
                ".view-notes-button"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async function () {

                            const unitId =
                                this.dataset.unitId;


                            const unitTitle =
                                this.dataset.unitTitle;


                            console.log(
                                "📄 Showing notes for:",
                                unitTitle,
                                unitId
                            );


                            await showUnitNotes(
                                unitId,
                                unitTitle
                            );

                        }
                    );

                }
            );


        console.log(
            `✅ ${data.length} units displayed`
        );


    } catch (error) {

        console.error(
            "❌ Unexpected units error:",
            error
        );


        unitsArea.innerHTML = `

            <div style="
                padding:20px;
                background:#fff0f0;
                color:#b00020;
                border-radius:12px;
            ">

                ❌ Something went wrong.

                <p>
                    ${escapeHTML(error.message)}
                </p>

            </div>

        `;

    }

}


// =====================================================
// GET DIRECT NOTES FROM UNIT
// =====================================================

function getUnitNotes(unit) {

    // =================================================
    // 1. FULL NOTES
    // =================================================

    if (
        typeof unit.notes_content === "string" &&
        unit.notes_content.trim().length > 0
    ) {

        return unit.notes_content.trim();

    }


    // =================================================
    // 2. OLD NOTES COLUMN
    // =================================================

    if (
        typeof unit.notes === "string" &&
        unit.notes.trim().length > 0
    ) {

        return unit.notes.trim();

    }


    return "";

}


// =====================================================
// LOAD QUIZ FOR ONE UNIT
// =====================================================

async function loadUnitQuiz(
    unitId,
    unitTitle
) {

    // =================================================
    // CHECK QUIZ AREA
    // =================================================

    let targetQuizArea =
        document.getElementById("quizArea");


    // If quizArea does not exist,
    // create it automatically.

    if (!targetQuizArea) {

        targetQuizArea =
            document.createElement("div");

        targetQuizArea.id =
            "quizArea";

        targetQuizArea.style.cssText = `
            margin:30px 0;
        `;


        if (notesArea) {

            notesArea.parentNode.insertBefore(
                targetQuizArea,
                notesArea
            );

        } else if (unitsArea) {

            unitsArea.parentNode.appendChild(
                targetQuizArea
            );

        } else {

            document.body.appendChild(
                targetQuizArea
            );

        }

    }


    targetQuizArea.innerHTML = `

        <div style="
            padding:25px;
            text-align:center;
            background:#f8fafc;
            border-radius:14px;
        ">

            ⏳ Loading quiz for

            <strong>
                ${escapeHTML(unitTitle)}
            </strong>...

        </div>

    `;


    targetQuizArea.scrollIntoView({
        behavior:"smooth",
        block:"start"
    });


    try {

        // =================================================
        // LOAD QUIZZES
        // =================================================

        console.log(
            "🔎 Quiz query:",
            {
                courseId,
                unitId,
                unitTitle
            }
        );


        const {
            data: quizzes,
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
                correct_answer
            `)

            .eq(
                "course_id",
                courseId
            )

            .eq(
                "unit",
                unitTitle
            )

            .order(
                "id",
                {
                    ascending:true
                }
            );


        // =================================================
        // DATABASE ERROR
        // =================================================

        if (error) {

            console.error(
                "❌ QUIZ DATABASE ERROR:",
                error
            );


            targetQuizArea.innerHTML = `

                <div style="
                    padding:25px;
                    background:#fff0f0;
                    color:#b00020;
                    border-radius:14px;
                ">

                    <h3>
                        ❌ Failed to load quiz
                    </h3>

                    <p>
                        ${escapeHTML(error.message)}
                    </p>

                    <p style="
                        font-size:13px;
                        color:#666;
                    ">

                        Course ID:
                        ${escapeHTML(courseId)}

                        <br>

                        Unit:
                        ${escapeHTML(unitTitle)}

                    </p>

                </div>

            `;

            return;
        }


        console.log(
            "✅ Quizzes loaded:",
            quizzes
        );


        // =================================================
        // NO QUIZZES
        // =================================================

        if (
            !quizzes ||
            quizzes.length === 0
        ) {

            targetQuizArea.innerHTML = `

                <div style="
                    padding:25px;
                    background:#fff8e6;
                    border-radius:14px;
                    border:1px solid #f0dfaa;
                ">

                    <h3>
                        📝 No quizzes found
                    </h3>

                    <p>
                        No quizzes are connected
                        to

                        <strong>
                            ${escapeHTML(unitTitle)}
                        </strong>.
                    </p>

                    <p style="
                        font-size:14px;
                        color:#666;
                    ">

                        Course ID:
                        ${escapeHTML(courseId)}

                        <br>

                        Unit ID:
                        ${escapeHTML(unitId)}

                    </p>

                </div>

            `;

            return;
        }


        // =================================================
        // RENDER QUIZ
        // =================================================

        renderUnitQuiz(
            unitTitle,
            quizzes
        );


    } catch (error) {

        console.error(
            "❌ Unexpected quiz error:",
            error
        );


        targetQuizArea.innerHTML = `

            <div style="
                padding:25px;
                background:#fff0f0;
                color:#b00020;
                border-radius:14px;
            ">

                <h3>
                    ❌ Quiz loading failed
                </h3>

                <p>
                    ${escapeHTML(error.message)}
                </p>

            </div>

        `;

    }

}


// =====================================================
// RENDER QUIZ
// =====================================================

function renderUnitQuiz(
    unitTitle,
    quizzes
) {

    const targetQuizArea =
        document.getElementById("quizArea");


    if (!targetQuizArea) {

        console.error(
            "❌ quizArea not found"
        );

        return;
    }


    targetQuizArea.innerHTML = "";


    // =================================================
    // QUIZ HEADER
    // =================================================

    const wrapper =
        document.createElement("div");


    wrapper.className =
        "quiz-container";


    wrapper.style.cssText = `
        background:#ffffff;
        padding:25px;
        margin:20px 0;
        border-radius:16px;
        border:1px solid #d9edf2;
        box-shadow:0 5px 18px rgba(0,0,0,.07);
    `;


    wrapper.innerHTML = `

        <div style="
            border-bottom:2px solid #e8f1f5;
            padding-bottom:15px;
            margin-bottom:25px;
        ">

            <h2 style="
                color:#063970;
                margin:0;
            ">

                📝
                ${escapeHTML(unitTitle)}

            </h2>


            <p style="
                color:#666;
                margin-bottom:0;
            ">

                ${quizzes.length}
                question${quizzes.length === 1 ? "" : "s"}

            </p>

        </div>

    `;


    // =================================================
    // QUESTIONS
    // =================================================

    quizzes.forEach(
        (quiz, index) => {

            const questionCard =
                document.createElement("div");


            questionCard.className =
                "quiz-question";


            questionCard.style.cssText = `
                padding:20px;
                margin-bottom:20px;
                background:#f8fafc;
                border-radius:12px;
                border:1px solid #e5e7eb;
            `;


            questionCard.innerHTML = `

                <h3 style="
                    margin-top:0;
                    color:#063970;
                    line-height:1.5;
                ">

                    ${index + 1}.
                    ${escapeHTML(quiz.question)}

                </h3>


                <div style="
                    display:flex;
                    flex-direction:column;
                    gap:12px;
                ">


                    <label style="
                        cursor:pointer;
                    ">

                        <input
                            type="radio"
                            name="quiz_${quiz.id}"
                            value="A"
                        >

                        A.
                        ${escapeHTML(quiz.option_a)}

                    </label>


                    <label style="
                        cursor:pointer;
                    ">

                        <input
                            type="radio"
                            name="quiz_${quiz.id}"
                            value="B"
                        >

                        B.
                        ${escapeHTML(quiz.option_b)}

                    </label>


                    <label style="
                        cursor:pointer;
                    ">

                        <input
                            type="radio"
                            name="quiz_${quiz.id}"
                            value="C"
                        >

                        C.
                        ${escapeHTML(quiz.option_c)}

                    </label>


                    <label style="
                        cursor:pointer;
                    ">

                        <input
                            type="radio"
                            name="quiz_${quiz.id}"
                            value="D"
                        >

                        D.
                        ${escapeHTML(quiz.option_d)}

                    </label>


                </div>

            `;


            wrapper.appendChild(
                questionCard
            );

        }
    );


    // =================================================
    // SUBMIT BUTTON
    // =================================================

    const submitButton =
        document.createElement("button");


    submitButton.type =
        "button";


    submitButton.textContent =
        "✅ Submit Quiz";


    submitButton.style.cssText = `
        padding:14px 24px;
        border:none;
        border-radius:10px;
        cursor:pointer;
        font-size:16px;
        font-weight:bold;
        margin-top:10px;
    `;


    submitButton.addEventListener(
        "click",
        function () {

            calculateQuizScore(
                quizzes,
                wrapper
            );

        }
    );


    wrapper.appendChild(
        submitButton
    );


    targetQuizArea.appendChild(
        wrapper
    );


    targetQuizArea.scrollIntoView({
        behavior:"smooth",
        block:"start"
    });


    console.log(
        `✅ Rendered ${quizzes.length} quizzes for ${unitTitle}`
    );

}


// =====================================================
// CALCULATE QUIZ SCORE
// =====================================================

function calculateQuizScore(
    quizzes,
    wrapper
) {

    let score = 0;

    let answered = 0;


    quizzes.forEach(
        quiz => {

            const selected =
                document.querySelector(
                    `input[name="quiz_${quiz.id}"]:checked`
                );


            if (!selected) {

                return;
            }


            answered++;


            const correctAnswer =
                String(
                    quiz.correct_answer ?? ""
                )
                .trim()
                .toUpperCase();


            let selectedAnswer =
                selected.value
                    .trim()
                    .toUpperCase();


            // =================================================
            // SUPPORT:
            // A / B / C / D
            // AND
            // OPTION TEXT
            // =================================================

            const optionTextMap = {

                A: String(
                    quiz.option_a ?? ""
                )
                .trim()
                .toUpperCase(),

                B: String(
                    quiz.option_b ?? ""
                )
                .trim()
                .toUpperCase(),

                C: String(
                    quiz.option_c ?? ""
                )
                .trim()
                .toUpperCase(),

                D: String(
                    quiz.option_d ?? ""
                )
                .trim()
                .toUpperCase()

            };


            let isCorrect =
                selectedAnswer ===
                correctAnswer;


            // If correct_answer contains
            // the actual option text.

            if (
                !isCorrect &&
                optionTextMap[selectedAnswer]
            ) {

                isCorrect =
                    optionTextMap[selectedAnswer] ===
                    correctAnswer;

            }


            if (isCorrect) {

                score++;

            }

        }
    );


    const percentage =
        quizzes.length > 0

        ?

        Math.round(
            (score / quizzes.length) * 100
        )

        :

        0;


    // =================================================
    // REMOVE OLD RESULT
    // =================================================

    const oldResult =
        wrapper.querySelector(
            ".quiz-result"
        );


    if (oldResult) {

        oldResult.remove();

    }


    // =================================================
    // RESULT
    // =================================================

    const result =
        document.createElement("div");


    result.className =
        "quiz-result";


    result.style.cssText = `
        margin-top:25px;
        padding:20px;
        background:#f0fdf4;
        border-radius:12px;
        border:1px solid #bbf7d0;
        font-weight:bold;
        line-height:1.8;
    `;


    result.innerHTML = `

        🎯 Quiz Result

        <br><br>

        Score:
        ${score}/${quizzes.length}

        <br>

        Percentage:
        ${percentage}%

        <br>

        Answered:
        ${answered}/${quizzes.length}

    `;


    wrapper.appendChild(
        result
    );


    result.scrollIntoView({
        behavior:"smooth",
        block:"center"
    });


    console.log(
        "🎯 Quiz score:",
        score,
        "/",
        quizzes.length
    );

}


// =====================================================
// SHOW NOTES FOR ONE UNIT
// =====================================================

async function showUnitNotes(
    unitId,
    unitTitle
) {

    if (!notesArea) {

        console.warn(
            "⚠️ notesArea not found"
        );

        return;
    }


    notesArea.innerHTML = `

        <div style="
            padding:20px;
            text-align:center;
        ">

            ⏳ Loading notes for

            <strong>
                ${escapeHTML(unitTitle)}
            </strong>...

        </div>

    `;


    notesArea.scrollIntoView({
        behavior:"smooth",
        block:"start"
    });


    try {

        // =================================================
        // LOAD UNIT
        // =================================================

        const {
            data: unit,
            error: unitError
        } = await supabase

            .from("units")

            .select(`
                id,
                course_id,
                title,
                notes,
                notes_content,
                image,
                video_url,
                created_at
            `)

            .eq(
                "id",
                unitId
            )

            .single();


        if (unitError) {

            console.error(
                "❌ UNIT NOTES ERROR:",
                unitError
            );

        }


        // =================================================
        // CHECK DIRECT NOTES
        // =================================================

        if (unit) {

            const directNotes =
                getUnitNotes(unit);


            if (
                directNotes &&
                directNotes.trim().length > 0
            ) {

                console.log(
                    "✅ Full unit notes found"
                );


                renderDetailedNotes(
                    unitTitle,
                    unitId,
                    directNotes
                );


                return;
            }

        }


        // =================================================
        // CHECK UPLOADED NOTES TABLE
        // =================================================

        const {
            data: uploadedNotes,
            error: notesError
        } = await supabase

            .from("notes")

            .select("*")

            .eq(
                "course_id",
                courseId
            )

            .eq(
                "unit_id",
                unitId
            )

            .order(
                "created_at",
                {
                    ascending:false
                }
            );


        if (notesError) {

            console.error(
                "❌ UPLOADED NOTES ERROR:",
                notesError
            );

        }


        // =================================================
        // DISPLAY UPLOADED NOTES
        // =================================================

        if (
            uploadedNotes &&
            uploadedNotes.length > 0
        ) {

            renderUploadedNotes(
                unitTitle,
                uploadedNotes
            );

            return;

        }


        // =================================================
        // FALLBACK BY UNIT NAME
        // =================================================

        const {
            data: fallbackNotes,
            error: fallbackError
        } = await supabase

            .from("notes")

            .select("*")

            .eq(
                "course_id",
                courseId
            )

            .eq(
                "unit",
                unitTitle
            )

            .order(
                "created_at",
                {
                    ascending:false
                }
            );


        if (fallbackError) {

            console.warn(
                "⚠️ Fallback notes search failed:",
                fallbackError
            );

        }


        if (
            fallbackNotes &&
            fallbackNotes.length > 0
        ) {

            renderUploadedNotes(
                unitTitle,
                fallbackNotes
            );

            return;

        }


        // =================================================
        // NOTHING FOUND
        // =================================================

        notesArea.innerHTML = `

            <div style="
                padding:25px;
                background:#fff8e6;
                border-radius:14px;
                border:1px solid #f0dfaa;
            ">

                <h3>
                    📄 No notes found
                </h3>


                <p>

                    No notes are currently
                    connected to

                    <strong>
                        ${escapeHTML(unitTitle)}
                    </strong>.

                </p>

            </div>

        `;


    } catch (error) {

        console.error(
            "❌ Unexpected notes error:",
            error
        );


        notesArea.innerHTML = `

            <div style="
                padding:20px;
                background:#fff0f0;
                color:#b00020;
                border-radius:12px;
            ">

                ❌ Failed to load notes.

                <p>
                    ${escapeHTML(error.message)}
                </p>

            </div>

        `;

    }

}


// =====================================================
// RENDER DETAILED NOTES
// =====================================================

function renderDetailedNotes(
    unitTitle,
    unitId,
    notes
) {

    notesArea.innerHTML = "";


    const noteCard =
        document.createElement("div");


    noteCard.className =
        "note-card";


    noteCard.dataset.unitId =
        unitId;


    noteCard.innerHTML = `

        <div style="
            background:#ffffff;
            padding:30px;
            margin:20px 0;
            border-radius:16px;
            border:1px solid #d9edf2;
            box-shadow:0 5px 18px rgba(0,0,0,.07);
        ">


            <div style="
                margin-bottom:25px;
                border-bottom:2px solid #e8f1f5;
                padding-bottom:15px;
            ">


                <h2 style="
                    color:#063970;
                    margin:0;
                ">

                    📚
                    ${escapeHTML(unitTitle)}

                </h2>


            </div>


            <article style="
                line-height:1.85;
                color:#222;
                font-size:16px;
            ">

                ${formatDetailedNotes(notes)}

            </article>


        </div>

    `;


    notesArea.appendChild(
        noteCard
    );


    notesArea.scrollIntoView({
        behavior:"smooth",
        block:"start"
    });

}


// =====================================================
// RENDER UPLOADED NOTES
// =====================================================

function renderUploadedNotes(
    unitTitle,
    notes
) {

    notesArea.innerHTML = "";


    const heading =
        document.createElement("div");


    heading.innerHTML = `

        <h2 style="
            color:#063970;
            margin-bottom:20px;
        ">

            📄
            ${escapeHTML(unitTitle)}

        </h2>

    `;


    notesArea.appendChild(
        heading
    );


    notes.forEach(
        note => {

            const filename =
                note.file_name ||
                "Study Notes";


            const fileUrl =
                note.file_url ||
                "";


            const noteCard =
                document.createElement("div");


            noteCard.className =
                "note-card";


            noteCard.dataset.unitId =
                note.unit_id || "";


            noteCard.innerHTML = `

                <div style="
                    background:white;
                    padding:20px;
                    margin:12px 0;
                    border-radius:14px;
                    border:1px solid #d9edf2;
                    box-shadow:0 4px 12px rgba(0,0,0,.06);
                ">


                    <h3 style="
                        color:#063970;
                        margin-top:0;
                    ">

                        📄
                        ${escapeHTML(filename)}

                    </h3>


                    ${
                        fileUrl

                        ?

                        `
                        <a
                            href="${escapeHTML(fileUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >

                            <button type="button">

                                📖 Open Notes

                            </button>

                        </a>
                        `

                        :

                        `
                        <p style="
                            color:#b00020;
                        ">

                            ⚠️ File URL unavailable.

                        </p>
                        `
                    }


                </div>

            `;


            notesArea.appendChild(
                noteCard
            );

        }
    );


    notesArea.scrollIntoView({
        behavior:"smooth",
        block:"start"
    });

}


// =====================================================
// FORMAT DETAILED NOTES
// =====================================================

function formatDetailedNotes(text) {

    if (!text) return "";


    // =================================================
    // ESCAPE HTML FIRST
    // =================================================

    let html =
        escapeHTML(text);


    // =================================================
    // HEADINGS
    // =================================================

    html = html.replace(
        /^###### (.*)$/gm,
        "<h6>$1</h6>"
    );


    html = html.replace(
        /^##### (.*)$/gm,
        "<h5>$1</h5>"
    );


    html = html.replace(
        /^#### (.*)$/gm,
        "<h4>$1</h4>"
    );


    html = html.replace(
        /^### (.*)$/gm,
        "<h3>$1</h3>"
    );


    html = html.replace(
        /^## (.*)$/gm,
        "<h2>$1</h2>"
    );


    html = html.replace(
        /^# (.*)$/gm,
        "<h1>$1</h1>"
    );


    // =================================================
    // BOLD
    // =================================================

    html = html.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );


    // =================================================
    // ITALICS
    // =================================================

    html = html.replace(
        /(?<!\*)\*([^*]+)\*(?!\*)/g,
        "<em>$1</em>"
    );


    // =================================================
    // BULLETS
    // =================================================

    html = html.replace(
        /^[-*] (.*)$/gm,
        "<li>$1</li>"
    );


    html = html.replace(
        /(<li>.*<\/li>\n?)+/g,
        match => `<ul>${match}</ul>`
    );


    // =================================================
    // HORIZONTAL RULE
    // =================================================

    html = html.replace(
        /^---$/gm,
        "<hr>"
    );


    // =================================================
    // NUMBERED LISTS
    // =================================================

    html = html.replace(
        /^\d+\. (.*)$/gm,
        "<li>$1</li>"
    );


    // =================================================
    // LINE BREAKS
    // =================================================

    html = html.replace(
        /\n{2,}/g,
        "</p><p>"
    );


    html = html.replace(
        /\n/g,
        "<br>"
    );


    return `
        <p>
            ${html}
        </p>
    `;

}


// =====================================================
// HTML ESCAPE
// =====================================================

function escapeHTML(value) {

    return String(
        value ?? ""
    )

    .replace(
        /&/g,
        "&amp;"
    )

    .replace(
        /</g,
        "&lt;"
    )

    .replace(
        />/g,
        "&gt;"
    )

    .replace(
        /"/g,
        "&quot;"
    )

    .replace(
        /'/g,
        "&#039;"
    );

}


// =====================================================
// INITIALIZE COURSE
// =====================================================

async function initializeCourse() {

    if (!courseId) {

        return;
    }


    await loadCourse();


    await loadUnits();

}


// =====================================================
// START
// =====================================================

initializeCourse();


// =====================================================
// ENGINE READY
// =====================================================

console.log(
    "📚 Mwaniki Scholars Course Engine Loaded"
);
```
