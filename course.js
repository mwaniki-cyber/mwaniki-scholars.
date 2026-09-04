import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS - COURSE PAGE ENGINE
// =====================================================
// Supports:
// 1. Full notes in units.notes_content
// 2. Older notes in units.notes
// 3. Uploaded notes in public.notes
// 4. Existing quiz.js engine
// =====================================================


// =====================================================
// SELECTED COURSE
// =====================================================

const courseId = localStorage.getItem("selectedCourse");
const courseName = localStorage.getItem("selectedCourseName");


// =====================================================
// PAGE ELEMENTS
// =====================================================

const courseTitle = document.getElementById("courseTitle");
const courseDescription = document.getElementById("courseDescription");
const unitsArea = document.getElementById("unitsArea");
const notesArea = document.getElementById("notesArea");


// =====================================================
// CHECK COURSE
// =====================================================

if (!courseId) {
    console.error("❌ No selected course found");

    if (courseTitle) {
        courseTitle.textContent = "❌ No course selected";
    }
} else {
    console.log("📚 Loading selected course:", courseId);
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
// GET DIRECT NOTES FROM UNIT
// =====================================================
// notes_content ALWAYS has priority over notes.
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
    // 2. FALLBACK TO OLD NOTES COLUMN
    // =================================================

    if (
        typeof unit.notes === "string" &&
        unit.notes.trim().length > 0
    ) {
        return unit.notes.trim();
    }


    // =================================================
    // 3. NOTHING FOUND
    // =================================================

    return "";
}


// =====================================================
// LOAD COURSE
// =====================================================

async function loadCourse() {

    if (!courseId) {
        return;
    }

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

            if (courseDescription) {
                courseDescription.textContent =
                    error.message || "Unable to load course information.";
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

        if (courseTitle) {
            courseTitle.textContent =
                "❌ Failed to load course";
        }
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

        // =================================================
        // LOAD UNIT COLUMNS
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
            .eq("course_id", courseId)
            .order("id", {
                ascending: true
            });


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


        if (!data || data.length === 0) {

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

        data.forEach((unit, index) => {

            const unitCard =
                document.createElement("div");


            unitCard.className =
                "unit-card";


            // notes_content checked FIRST
            const directNotes =
                getUnitNotes(unit);


            const hasDirectNotes =
                directNotes.trim().length > 0;


            unitCard.innerHTML = `

                <div style="
                    padding:20px;
                    margin-bottom:15px;
                    background:#ffffff;
                    border-radius:14px;
                    border:1px solid #d9edf2;
                    box-shadow:0 4px 12px rgba(0,0,0,.06);
                ">

                    <h3 style="
                        margin:0 0 10px 0;
                        color:#063970;
                    ">
                        📖 ${escapeHTML(unit.title)}
                    </h3>


                    <div style="
                        margin-top:15px;
                        display:flex;
                        gap:10px;
                        flex-wrap:wrap;
                    ">

                        <button
                            type="button"
                            class="start-quiz-button"
                            data-unit-id="${escapeHTML(unit.id)}"
                            data-unit-title="${escapeHTML(unit.title)}"
                        >
                            📝 Start Quiz
                        </button>


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
                            ? `
                                <div style="
                                    margin-top:10px;
                                    color:#137333;
                                    font-size:14px;
                                ">
                                    ✅ Detailed notes available
                                </div>
                            `
                            : `
                                <div style="
                                    margin-top:10px;
                                    color:#777;
                                    font-size:14px;
                                ">
                                    📄 Notes will load from the notes library
                                </div>
                            `
                    }

                </div>

            `;


            unitsArea.appendChild(
                unitCard
            );

        });


        // =================================================
        // QUIZ BUTTONS
        // =================================================

        document
            .querySelectorAll(".start-quiz-button")
            .forEach(button => {

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


                        // Existing quiz.js engine
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
            });


        // =================================================
        // NOTES BUTTONS
        // =================================================

        document
            .querySelectorAll(".view-notes-button")
            .forEach(button => {

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
            });


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
        behavior: "smooth",
        block: "start"
    });


    try {

        // =================================================
        // FIRST: LOAD THE UNIT
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
            .eq("id", unitId)
            .single();


        if (unitError) {

            console.error(
                "❌ UNIT NOTES ERROR:",
                unitError
            );
        }


        // =================================================
        // CHECK DIRECT UNIT NOTES
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
        // SECOND: CHECK UPLOADED NOTES TABLE
        // =================================================

        const {
            data: uploadedNotes,
            error: notesError
        } = await supabase
            .from("notes")
            .select("*")
            .eq("course_id", courseId)
            .eq("unit_id", unitId)
            .order("created_at", {
                ascending: false
            });


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
        // LAST FALLBACK:
        // SEARCH NOTES BY COURSE + UNIT NAME
        // =================================================

        const {
            data: fallbackNotes,
            error: fallbackError
        } = await supabase
            .from("notes")
            .select("*")
            .eq("course_id", courseId)
            .eq("unit", unitTitle)
            .order("created_at", {
                ascending: false
            });


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
                    No notes are currently connected
                    to

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

    if (!notesArea) {
        return;
    }


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

                    📚 ${escapeHTML(unitTitle)}

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
        behavior: "smooth",
        block: "start"
    });
}


// =====================================================
// RENDER UPLOADED NOTES
// =====================================================

function renderUploadedNotes(
    unitTitle,
    notes
) {

    if (!notesArea) {
        return;
    }


    notesArea.innerHTML = "";


    const heading =
        document.createElement("div");


    heading.innerHTML = `

        <h2 style="
            color:#063970;
            margin-bottom:20px;
        ">

            📄 ${escapeHTML(unitTitle)}

        </h2>

    `;


    notesArea.appendChild(
        heading
    );


    notes.forEach(note => {

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

                    📄 ${escapeHTML(filename)}

                </h3>


                ${
                    fileUrl
                        ? `
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
                        : `
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
    });


    notesArea.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// =====================================================
// FORMAT DETAILED NOTES
// =====================================================
// Converts Markdown-style notes into HTML.
// =====================================================

function formatDetailedNotes(text) {

    if (!text) {
        return "";
    }


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
    // HORIZONTAL RULE
    // =================================================

    html = html.replace(
        /^---$/gm,
        "<hr>"
    );


    // =================================================
    // BULLET LISTS
    // =================================================

    html = html.replace(
        /^[-*] (.*)$/gm,
        "<li>$1</li>"
    );


    html = html.replace(
        /((?:<li>.*<\/li>\n?)+)/g,
        match => `<ul>${match}</ul>`
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


    // =================================================
    // RETURN
    // =================================================

    return `
        <p>
            ${html}
        </p>
    `;
}


// =====================================================
// INITIALIZE COURSE
// =====================================================

async function initializeCourse() {

    console.log(
        "🚀 Initializing Mwaniki Scholars course page..."
    );


    console.log(
        "Course ID:",
        courseId
    );


    console.log(
        "Course Name:",
        courseName
    );


    if (!courseId) {

        console.error(
            "❌ Cannot initialize course without courseId"
        );

        return;
    }


    await loadCourse();

    await loadUnits();
}


// =====================================================
// INITIALIZE
// =====================================================

initializeCourse();


// =====================================================
// ENGINE READY
// =====================================================

console.log(
    "📚 Mwaniki Scholars Course Engine Loaded"
);
