import { supabase } from "./supabase.js";

console.log("📚 Mwaniki Scholars Course Engine Loaded");


// =====================================================
// GLOBAL VARIABLES
// =====================================================

let courseId = null;
let courseName = "";


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
// GET COURSE
// =====================================================

async function loadCourse() {

    courseId =
        Number(localStorage.getItem("selectedCourse"));

    courseName =
        localStorage.getItem("selectedCourseName") || "";


    console.log("📚 Loading selected course:", courseId);


    if (!courseId) {

        console.error("❌ No selected course");

        showCourseError(
            "No course was selected."
        );

        return;
    }


    try {

        // -------------------------------------------------
        // LOAD COURSE FROM SUPABASE
        // -------------------------------------------------

        const {
            data: course,
            error: courseError
        } = await supabase
            .from("courses")
            .select("*")
            .eq("id", courseId)
            .single();


        if (courseError) {

            console.error(
                "❌ Course loading error:",
                courseError
            );

            throw courseError;
        }


        console.log(
            "✅ Course loaded:",
            course
        );


        courseName =
            course.title || courseName;


        localStorage.setItem(
            "selectedCourseName",
            courseName
        );


        // -------------------------------------------------
        // DISPLAY COURSE TITLE
        // -------------------------------------------------

        const titleElements =
            document.querySelectorAll(
                "#courseTitle, .course-title"
            );


        titleElements.forEach(element => {

            element.textContent = courseName;

        });


        // -------------------------------------------------
        // LOAD UNITS
        // -------------------------------------------------

        await loadUnits();

    } catch (error) {

        console.error(
            "❌ Course initialization failed:",
            error
        );

        showCourseError(
            error.message
        );
    }
}


// =====================================================
// LOAD UNITS
// =====================================================

async function loadUnits() {

    console.log(
        "📖 Loading units for course:",
        courseId
    );


    const courseArea =
        document.getElementById("courseArea");


    if (!courseArea) {

        console.error(
            "❌ #courseArea was not found"
        );

        return;
    }


    courseArea.innerHTML = `
        <div class="loading">
            📚 Loading units...
        </div>
    `;


    try {

        const {
            data: units,
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
                "❌ Units query error:",
                error
            );

            throw error;
        }


        console.log(
            "📚 Units loaded:",
            units
        );


        if (!units || units.length === 0) {

            courseArea.innerHTML = `

                <div class="empty-state">

                    <h2>📚 No Units Yet</h2>

                    <p>
                        No units have been added
                        to this course yet.
                    </p>

                </div>

            `;

            return;
        }


        renderUnits(units);


    } catch (error) {

        console.error(
            "❌ Failed to load units:",
            error
        );


        courseArea.innerHTML = `

            <div class="error-state">

                <h2>⚠️ Unable to Load Units</h2>

                <p>
                    ${escapeHTML(error.message)}
                </p>

            </div>

        `;
    }
}


// =====================================================
// RENDER UNITS
// =====================================================

function renderUnits(units) {

    const courseArea =
        document.getElementById("courseArea");


    if (!courseArea) return;


    courseArea.innerHTML = "";


    units.forEach((unit, index) => {

        const card =
            document.createElement("div");


        card.className = "unit-card";


        const image =
            getSafeImage(unit.image);


        card.innerHTML = `

            <div class="unit-image">

                ${
                    image
                        ? `
                            <img
                                src="${escapeHTML(image)}"
                                alt="${escapeHTML(unit.title)}"
                                onerror="this.style.display='none'"
                            >
                          `
                        : `
                            <div class="unit-placeholder">
                                📖
                            </div>
                          `
                }

            </div>


            <div class="unit-content">

                <div class="unit-number">
                    Unit ${index + 1}
                </div>


                <h2>
                    ${escapeHTML(unit.title)}
                </h2>


                ${
                    unit.notes_content || unit.notes
                        ? `
                            <p>
                                📚 Detailed notes available
                            </p>
                          `
                        : ""
                }


                <div class="unit-actions">

                    <button
                        class="quiz-button"
                        onclick="
                            startUnitQuiz(
                                ${Number(unit.id)},
                                '${escapeHTML(unit.title).replace(/'/g, "\\'")}'
                            )
                        "
                    >
                        📝 Start Quiz
                    </button>


                    <button
                        class="notes-button"
                        onclick="
                            showUnitNotes(
                                ${Number(unit.id)}
                            )
                        "
                    >
                        📄 View Notes
                    </button>

                </div>

            </div>

        `;


        courseArea.appendChild(card);

    });


    console.log(
        `✅ ${units.length} units displayed`
    );
}


// =====================================================
// SAFE IMAGE
// =====================================================

function getSafeImage(image) {

    if (!image) return null;

    const value =
        String(image).trim();


    // Reject emojis / plain text
    if (
        !value.startsWith("http://") &&
        !value.startsWith("https://") &&
        !value.startsWith("/") &&
        !value.startsWith("./")
    ) {
        return null;
    }


    return value;
}


// =====================================================
// START UNIT QUIZ
// =====================================================

window.startUnitQuiz = function(
    unitId,
    unitTitle
) {

    console.log(
        "📝 Starting quiz:",
        courseId,
        unitId,
        unitTitle
    );


    localStorage.setItem(
        "selectedCourse",
        String(courseId)
    );


    localStorage.setItem(
        "selectedCourseName",
        courseName
    );


    localStorage.setItem(
        "selectedUnit",
        String(unitId)
    );


    localStorage.setItem(
        "selectedUnitTitle",
        unitTitle
    );


    // IMPORTANT:
    // Go to OUR quiz.html.
    // quiz.html loads quiz.js.
    // quiz.js loads questions from Supabase.

    window.location.href =
        `quiz.html?course=${encodeURIComponent(courseId)}&unit=${encodeURIComponent(unitId)}&title=${encodeURIComponent(unitTitle)}`;
};


// =====================================================
// VIEW NOTES
// =====================================================

window.showUnitNotes = async function(unitId) {

    console.log(
        "📄 Loading notes for unit:",
        unitId
    );


    try {

        const {
            data: unit,
            error
        } = await supabase

            .from("units")

            .select(`
                id,
                title,
                notes,
                notes_content
            `)

            .eq("id", Number(unitId))

            .single();


        if (error) throw error;


        displayNotes(unit);


    } catch (error) {

        console.error(
            "❌ Notes loading error:",
            error
        );


        alert(
            "Unable to load notes: " +
            error.message
        );
    }
};


// =====================================================
// DISPLAY NOTES
// =====================================================

function displayNotes(unit) {

    const existing =
        document.getElementById(
            "notesModal"
        );


    if (existing) {
        existing.remove();
    }


    const content =
        unit.notes_content ||
        unit.notes ||
        "No notes available.";


    const modal =
        document.createElement("div");


    modal.id = "notesModal";

    modal.className = "notes-modal";


    modal.innerHTML = `

        <div class="notes-modal-content">

            <button
                class="close-notes"
                onclick="
                    document.getElementById('notesModal').remove()
                "
            >
                ✕
            </button>


            <h2>
                📄 ${escapeHTML(unit.title)}
            </h2>


            <div class="notes-body">

                ${formatNotes(content)}

            </div>

        </div>

    `;


    document.body.appendChild(modal);
}


// =====================================================
// FORMAT NOTES
// =====================================================

function formatNotes(text) {

    if (!text) return "";


    return escapeHTML(text)
        .replace(/\n\n/g, "</p><p>")
        .replace(/\n/g, "<br>");
}


// =====================================================
// ERROR
// =====================================================

function showCourseError(message) {

    const courseArea =
        document.getElementById("courseArea");


    if (!courseArea) return;


    courseArea.innerHTML = `

        <div class="error-state">

            <h2>⚠️ Course Error</h2>

            <p>
                ${escapeHTML(message)}
            </p>

        </div>

    `;
}


// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "🚀 Initializing Mwaniki Scholars course page..."
        );


        loadCourse();

    }
);
