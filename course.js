import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS - COURSE PAGE ENGINE
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


// =====================================================
// CHECK COURSE
// =====================================================

if (!courseId) {

    console.error("❌ No selected course found");

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
// HTML ESCAPE
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
// MARKDOWN RENDERER
// =====================================================

function renderMarkdown(markdown) {

    if (!markdown) {
        return "";
    }

    let html = escapeHTML(markdown);

    // Code blocks
    html = html.replace(
        /```([\s\S]*?)```/g,
        "<pre><code>$1</code></pre>"
    );

    // Headings
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

    // Horizontal rules
    html = html.replace(
        /^---$/gm,
        "<hr>"
    );

    // Bold
    html = html.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    // Italic
    html = html.replace(
        /\*(.*?)\*/g,
        "<em>$1</em>"
    );

    // Unordered lists
    html = html.replace(
        /^(?:- .*(?:\n|$))+?/gm,
        function(block) {

            const items =
                block
                    .trim()
                    .split("\n")
                    .map(item =>
                        item.replace(
                            /^- (.*)$/,
                            "<li>$1</li>"
                        )
                    )
                    .join("");

            return `<ul>${items}</ul>`;
        }
    );

    // Ordered lists
    html = html.replace(
        /^(?:\d+\. .*(?:\n|$))+?/gm,
        function(block) {

            const items =
                block
                    .trim()
                    .split("\n")
                    .map(item =>
                        item.replace(
                            /^\d+\. (.*)$/,
                            "<li>$1</li>"
                        )
                    )
                    .join("");

            return `<ol>${items}</ol>`;
        }
    );

    // Preserve line breaks
    html = html.replace(
        /\n{2,}/g,
        "</p><p>"
    );

    html =
        "<p>" +
        html +
        "</p>";

    return html;

}


// =====================================================
// SHOW UNIT NOTES
// =====================================================

function showUnitNotes(unit) {

    if (!notesArea) {

        console.error(
            "❌ notesArea not found"
        );

        return;
    }


    console.log(
        "📄 Opening notes:",
        unit.title,
        unit.id
    );


    if (
        !unit.notes ||
        unit.notes.trim() === ""
    ) {

        notesArea.innerHTML = `

            <div style="
                padding:25px;
                margin:20px 0;
                background:#fff8e6;
                border-radius:14px;
                border:1px solid #f1d58a;
            ">

                <h3>
                    📄 No notes available
                </h3>

                <p>
                    No notes have been added for
                    <strong>
                        ${escapeHTML(unit.title)}
                    </strong>
                    yet.
                </p>

            </div>

        `;

        notesArea.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        return;
    }


    const renderedNotes =
        renderMarkdown(unit.notes);


    notesArea.innerHTML = `

        <article
            class="unit-notes"
            data-unit-id="${unit.id}"
            style="
                background:#ffffff;
                padding:30px;
                margin:25px 0;
                border-radius:18px;
                border:1px solid #d9edf2;
                box-shadow:
                    0 8px 25px
                    rgba(0,0,0,.08);
                line-height:1.75;
            "
        >

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:15px;
                flex-wrap:wrap;
                margin-bottom:25px;
                padding-bottom:15px;
                border-bottom:2px solid #eef5f7;
            ">

                <div>

                    <div style="
                        font-size:14px;
                        color:#668;
                        margin-bottom:5px;
                    ">
                        📚 ${escapeHTML(courseName || "Medical Course")}
                    </div>

                    <h2 style="
                        margin:0;
                        color:#063970;
                    ">
                        📖 ${escapeHTML(unit.title)}
                    </h2>

                </div>


                <button
                    type="button"
                    id="closeNotesButton"
                    style="
                        padding:10px 16px;
                        border:none;
                        border-radius:10px;
                        cursor:pointer;
                        background:#eef5f7;
                        color:#063970;
                        font-weight:600;
                    "
                >
                    ✕ Close
                </button>

            </div>


            <div class="notes-content">

                ${renderedNotes}

            </div>

        </article>

    `;


    const closeButton =
        document.getElementById(
            "closeNotesButton"
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            () => {

                notesArea.innerHTML = "";

                notesArea.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            }
        );

    }


    notesArea.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

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

    }

    catch (error) {

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
        <p>⏳ Loading units...</p>
    `;


    try {

        const {
            data,
            error
        } = await supabase

            .from("units")

            .select(
                "id, course_id, title, notes, image"
            )

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


        data.forEach(
            (unit, index) => {

                const unitCard =
                    document.createElement(
                        "div"
                    );


                unitCard.className =
                    "unit-card";


                unitCard.innerHTML = `

                    <h3>

                        📖 Unit ${index + 1}:
                        ${escapeHTML(unit.title)}

                    </h3>


                    ${
                        unit.image
                        ?

                        `
                        <div style="
                            margin:15px 0;
                        ">

                            <img
                                src="${escapeHTML(unit.image)}"
                                alt="${escapeHTML(unit.title)}"
                                style="
                                    width:100%;
                                    max-width:500px;
                                    border-radius:14px;
                                "
                            >

                        </div>
                        `

                        :

                        ""
                    }


                    <div style="
                        margin-top:15px;
                        display:flex;
                        gap:10px;
                        flex-wrap:wrap;
                    ">


                        <button
                            class="start-quiz-button"
                            data-unit-id="${unit.id}"
                            data-unit-title="${escapeHTML(unit.title)}"
                        >

                            📝 Start Quiz

                        </button>


                        <button
                            class="view-notes-button"
                            data-unit-id="${unit.id}"
                        >

                            📄 View Notes

                        </button>


                    </div>

                `;


                // Store the actual unit object
                // directly on the card.

                unitCard._unitData =
                    unit;


                unitsArea.appendChild(
                    unitCard
                );

            }
        );


        // =================================================
        // QUIZ BUTTONS
        // =================================================

        document
            .querySelectorAll(
                ".start-quiz-button"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function() {

                            const unitId =
                                this.dataset.unitId;


                            const unitTitle =
                                this.dataset.unitTitle;


                            console.log(
                                "📝 Starting quiz:",
                                unitTitle,
                                unitId
                            );


                            if (
                                typeof window.loadQuiz ===
                                "function"
                            ) {

                                window.loadQuiz(
                                    unitId,
                                    unitTitle
                                );

                            } else {

                                console.error(
                                    "❌ quiz.js loadQuiz() not available"
                                );


                                const quizArea =
                                    document.getElementById(
                                        "quizArea"
                                    );


                                if (quizArea) {

                                    quizArea.innerHTML = `

                                        <div style="
                                            padding:20px;
                                            background:#fff0f0;
                                            color:#b00020;
                                            border-radius:12px;
                                        ">

                                            ❌ Quiz engine
                                            could not be loaded.

                                            <br><br>

                                            Please refresh
                                            the page.

                                        </div>

                                    `;

                                }

                            }

                        }
                    );

                }
            );


        // =================================================
        // NOTES BUTTONS
        // =================================================

        document
            .querySelectorAll(
                ".view-notes-button"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function() {

                            const unitId =
                                Number(
                                    this.dataset.unitId
                                );


                            console.log(
                                "📄 Showing notes for unit:",
                                unitId
                            );


                            const selectedUnit =
                                data.find(
                                    unit =>
                                        Number(unit.id) ===
                                        unitId
                                );


                            if (!selectedUnit) {

                                console.error(
                                    "❌ Unit not found:",
                                    unitId
                                );

                                if (notesArea) {

                                    notesArea.innerHTML = `

                                        <div style="
                                            padding:20px;
                                            background:#fff0f0;
                                            color:#b00020;
                                            border-radius:12px;
                                        ">

                                            ❌ Could not find
                                            this unit.

                                        </div>

                                    `;

                                }

                                return;
                            }


                            showUnitNotes(
                                selectedUnit
                            );

                        }
                    );

                }
            );

    }

    catch (error) {

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


console.log(
    "📚 Mwaniki Scholars Course Engine Loaded"
);