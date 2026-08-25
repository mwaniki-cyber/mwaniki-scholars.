import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS - COURSE PAGE ENGINE
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
// BACK TO DASHBOARD
// =====================================================

function setupDashboardButton() {

    const backToDashboard =
        document.getElementById(
            "backToDashboard"
        );


    if (!backToDashboard) {

        console.warn(
            "⚠️ Back to Dashboard button not found"
        );

        return;

    }


    backToDashboard.addEventListener(
        "click",
        function () {

            console.log(
                "🏠 Returning to dashboard..."
            );


            // Make sure selected course data
            // does not interfere with dashboard

            localStorage.removeItem(
                "selectedCourse"
            );

            localStorage.removeItem(
                "selectedCourseName"
            );


            window.location.href =
                "dashboard.html";

        }
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

            .eq(
                "id",
                courseId
            )

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

        <p>
            ⏳ Loading units...
        </p>

    `;


    try {

        const {
            data,
            error
        } = await supabase

            .from("units")

            .select("*")

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
                        ${escapeHTML(
                            error.message
                        )}
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
                        ${escapeHTML(
                            unit.title
                        )}

                    </h3>


                    <div style="
                        margin-top:15px;
                        display:flex;
                        gap:10px;
                        flex-wrap:wrap;
                    ">


                        <button
                            class="start-quiz-button"
                            data-unit-id="${unit.id}"
                            data-unit-title="${escapeHTML(
                                unit.title
                            )}"
                        >

                            📝 Start Quiz

                        </button>


                        <button
                            class="view-notes-button"
                            data-unit-id="${unit.id}"
                            data-unit-title="${escapeHTML(
                                unit.title
                            )}"
                        >

                            📄 View Notes

                        </button>


                    </div>

                `;


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
                        function () {

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

                            }

                            else {

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
                        function () {

                            const unitId =
                                this.dataset.unitId;


                            const unitTitle =
                                this.dataset.unitTitle;


                            console.log(
                                "📄 Showing notes for:",
                                unitTitle,
                                unitId
                            );


                            const matchingNotes =
                                document.querySelectorAll(
                                    `.note-card[data-unit-id="${unitId}"]`
                                );


                            if (
                                matchingNotes.length > 0
                            ) {

                                matchingNotes[0]
                                    .scrollIntoView({
                                        behavior:
                                            "smooth",
                                        block:
                                            "start"
                                    });


                                // Highlight the note

                                matchingNotes[0].style
                                    .outline =
                                    "3px solid #0b7285";


                                setTimeout(
                                    () => {

                                        matchingNotes[0].style
                                            .outline =
                                            "";

                                    },
                                    2000
                                );

                            }

                            else {

                                if (notesArea) {

                                    notesArea.innerHTML += `

                                        <div style="
                                            padding:15px;
                                            margin:10px 0;
                                            background:#fff8e6;
                                            border-radius:10px;
                                        ">

                                            📄 No notes found
                                            for

                                            <strong>
                                                ${escapeHTML(
                                                    unitTitle
                                                )}
                                            </strong>.

                                        </div>

                                    `;


                                    notesArea
                                        .scrollIntoView({
                                            behavior:
                                                "smooth"
                                        });

                                }

                            }

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
                    ${escapeHTML(
                        error.message
                    )}
                </p>

            </div>

        `;

    }

}


// =====================================================
// LOAD NOTES
// =====================================================

async function loadNotes() {

    if (!notesArea) {

        console.warn(
            "⚠️ notesArea not found"
        );

        return;

    }


    notesArea.innerHTML = `

        <p>
            ⏳ Loading notes...
        </p>

    `;


    try {

        const {
            data,
            error
        } = await supabase

            .from("notes")

            .select("*")

            .eq(
                "course_id",
                courseId
            )

            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            console.error(
                "❌ NOTES ERROR:",
                error
            );


            notesArea.innerHTML = `

                <div style="
                    padding:20px;
                    background:#fff0f0;
                    color:#b00020;
                    border-radius:12px;
                ">

                    ❌ Failed to load notes

                    <p>
                        ${escapeHTML(
                            error.message
                        )}
                    </p>

                </div>

            `;

            return;

        }


        console.log(
            "📄 Notes loaded:",
            data
        );


        if (
            !data ||
            data.length === 0
        ) {

            notesArea.innerHTML = `

                <div style="
                    padding:20px;
                    background:#fff8e6;
                    border-radius:12px;
                ">

                    📄 No notes available
                    for this course yet.

                </div>

            `;

            return;

        }


        notesArea.innerHTML = "";


        // =================================================
        // CREATE NOTE CARDS
        // =================================================

        data.forEach(
            note => {

                const filename =
                    note.file_name ||
                    note.filename ||
                    "Study Notes";


                const unit =
                    note.unit ||
                    note.unit_title ||
                    "Course Material";


                const fileUrl =
                    note.file_url ||
                    "";


                const noteCard =
                    document.createElement(
                        "div"
                    );


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
                        box-shadow:
                            0 4px 12px
                            rgba(0,0,0,.06);
                    ">


                        <h3 style="
                            color:#063970;
                            margin-top:0;
                        ">

                            📄
                            ${escapeHTML(
                                filename
                            )}

                        </h3>


                        <p>

                            📖
                            ${escapeHTML(
                                unit
                            )}

                        </p>


                        ${
                            fileUrl

                            ?

                            `

                                <a
                                    href="${escapeHTML(
                                        fileUrl
                                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >

                                    <button>

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

    }

    catch (error) {

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
                    ${escapeHTML(
                        error.message
                    )}
                </p>

            </div>

        `;

    }

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
// INITIALIZE COURSE PAGE
// =====================================================

async function initializeCourse() {

    console.log(
        "🚀 Initializing Mwaniki Scholars course..."
    );


    if (!courseId) {

        console.error(
            "❌ Cannot initialize course: no course ID"
        );

        return;

    }


    // Set up dashboard navigation first

    setupDashboardButton();


    // Load course information

    await loadCourse();


    // Load units

    await loadUnits();


    // Load notes

    await loadNotes();


    console.log(
        "✅ Course page fully initialized"
    );

}


// =====================================================
// START
// =====================================================

initializeCourse();


console.log(
    "📚 Mwaniki Scholars Course Engine Loaded"
);
