import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS - COURSE ENGINE
// =====================================================

console.log(
    "📚 Mwaniki Scholars Course Engine Loaded"
);


// =====================================================
// GLOBAL VARIABLES
// =====================================================

let courseId = null;
let courseName = "";
let courseData = null;
let unitsData = [];


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


function getCourseArea() {

    return (
        document.getElementById("courseArea") ||
        document.getElementById("unitsArea") ||
        document.getElementById("courseContent")
    );

}


// =====================================================
// GET COURSE ID
// =====================================================

function getSelectedCourseId() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const fromURL =
        params.get("course") ||
        params.get("course_id");


    const fromStorage =
        localStorage.getItem(
            "selectedCourse"
        );


    return fromURL || fromStorage;
}


// =====================================================
// GET COURSE NAME
// =====================================================

function getSelectedCourseName() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    return (
        params.get("courseName") ||
        localStorage.getItem(
            "selectedCourseName"
        ) ||
        ""
    );
}


// =====================================================
// SAVE COURSE
// =====================================================

function saveCourseSelection(
    id,
    name = ""
) {

    localStorage.setItem(
        "selectedCourse",
        String(id)
    );


    if (name) {

        localStorage.setItem(
            "selectedCourseName",
            name
        );

    }

}


// =====================================================
// LOAD COURSE
// =====================================================

async function loadCourse() {

    console.log(
        "📚 Loading selected course..."
    );


    courseId =
        getSelectedCourseId();


    courseName =
        getSelectedCourseName();


    if (!courseId) {

        showCourseError(
            "No course was selected."
        );

        return;

    }


    courseId =
        Number(courseId);


    console.log(
        "Course ID:",
        courseId
    );


    try {

        const {
            data,
            error
        } = await supabase

            .from("courses")

            .select(`
                id,
                title,
                description,
                image,
                created_at
            `)

            .eq(
                "id",
                courseId
            )

            .single();


        if (error) {

            console.error(
                "❌ Course query error:",
                error
            );

            showCourseError(
                error.message
            );

            return;

        }


        if (!data) {

            showCourseError(
                "Course was not found."
            );

            return;

        }


        courseData =
            data;


        courseName =
            data.title ||
            courseName ||
            "Course";


        saveCourseSelection(
            courseId,
            courseName
        );


        console.log(
            "✅ Course loaded:",
            courseData
        );


        renderCourseHeader();


        await loadUnits();

    } catch (error) {

        console.error(
            "❌ Course loading failed:",
            error
        );

        showCourseError(
            error.message
        );

    }

}


// =====================================================
// COURSE HEADER
// =====================================================

function renderCourseHeader() {

    const titleElements =
        document.querySelectorAll(
            "#courseTitle, .course-title"
        );


    titleElements.forEach(
        element => {

            element.textContent =
                courseName;

        }
    );


    const descriptionElements =
        document.querySelectorAll(
            "#courseDescription, .course-description"
        );


    descriptionElements.forEach(
        element => {

            element.textContent =
                courseData?.description ||
                "";

        }
    );


    const courseImage =
        document.getElementById(
            "courseImage"
        );


    if (
        courseImage &&
        isValidImageURL(
            courseData?.image
        )
    ) {

        courseImage.src =
            courseData.image;

        courseImage.alt =
            courseName;

        courseImage.style.display =
            "block";

    } else if (courseImage) {

        courseImage.style.display =
            "none";

    }

}


// =====================================================
// LOAD UNITS
// =====================================================

async function loadUnits() {

    console.log(
        "📖 Loading course units..."
    );


    const courseArea =
        getCourseArea();


    if (!courseArea) {

        console.error(
            "❌ Course area not found."
        );

        return;

    }


    courseArea.innerHTML = `

        <div class="course-loading">

            <div style="font-size:45px;">
                ⏳
            </div>

            <h2>
                Loading Units...
            </h2>

            <p>
                Please wait...
            </p>

        </div>

    `;


    try {

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
                "❌ Units query error:",
                error
            );

            showCourseError(
                error.message
            );

            return;

        }


        unitsData =
            data || [];


        console.log(
            `✅ ${unitsData.length} units loaded`
        );


        if (
            unitsData.length === 0
        ) {

            courseArea.innerHTML = `

                <div class="empty-units">

                    <div style="font-size:60px;">
                        📚
                    </div>

                    <h2>
                        No Units Available
                    </h2>

                    <p>
                        This course does not have
                        any units yet.
                    </p>

                </div>

            `;

            return;

        }


        renderUnits();

    } catch (error) {

        console.error(
            "❌ Failed to load units:",
            error
        );

        showCourseError(
            error.message
        );

    }

}


// =====================================================
// VALID IMAGE URL
// =====================================================

function isValidImageURL(
    value
) {

    if (!value) {
        return false;
    }


    const url =
        String(value).trim();


    if (!url) {
        return false;
    }


    return (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("data:image/")
    );

}


// =====================================================
// VALID VIDEO URL
// =====================================================

function isValidVideoURL(
    value
) {

    if (!value) {
        return false;
    }


    const url =
        String(value).trim();


    return (
        url.startsWith("http://") ||
        url.startsWith("https://")
    );

}


// =====================================================
// RENDER UNITS
// =====================================================

function renderUnits() {

    const courseArea =
        getCourseArea();


    if (!courseArea) {
        return;
    }


    courseArea.innerHTML = "";


    unitsData.forEach(
        (unit, index) => {

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "unit-card";


            card.dataset.unitId =
                unit.id;


            const imageHTML =
                isValidImageURL(
                    unit.image
                )

                    ? `
                        <div class="unit-image-container">

                            <img
                                src="${escapeHTML(
                                    unit.image
                                )}"
                                alt="${escapeHTML(
                                    unit.title
                                )}"
                                class="unit-image"
                                loading="lazy"
                                onerror="
                                    this.style.display='none';
                                "
                            >

                        </div>
                    `

                    : `
                        <div class="unit-icon">
                            📖
                        </div>
                    `;


            const videoHTML =
                isValidVideoURL(
                    unit.video_url
                )

                    ? `

                        <div class="unit-video">

                            <video
                                controls
                                preload="metadata"
                                playsinline
                            >

                                <source
                                    src="${escapeHTML(
                                        unit.video_url
                                    )}"
                                >

                                Your browser does not
                                support video playback.

                            </video>

                        </div>

                    `

                    : "";


            const notesAvailable =
                Boolean(
                    unit.notes ||
                    unit.notes_content
                );


            card.innerHTML = `

                <div class="unit-number">

                    Unit ${index + 1}

                </div>


                ${imageHTML}


                <div class="unit-content">

                    <h2 class="unit-title">

                        ${escapeHTML(
                            unit.title
                        )}

                    </h2>


                    ${
                        unit.notes
                            ? `
                                <p class="unit-description">
                                    ${escapeHTML(
                                        unit.notes
                                    )}
                                </p>
                              `
                            : ""
                    }


                    ${videoHTML}


                    <div class="unit-actions">

                        <button
                            type="button"
                            class="quiz-button"
                            onclick="
                                startUnitQuiz(
                                    ${Number(unit.id)}
                                )
                            "
                        >
                            📝 Start Quiz
                        </button>


                        <button
                            type="button"
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


                    ${
                        notesAvailable
                            ? `
                                <div class="notes-status">
                                    📚 Detailed notes available
                                </div>
                              `
                            : `
                                <div class="notes-status">
                                    ℹ️ Notes will appear here
                                </div>
                              `
                    }

                </div>

            `;


            courseArea.appendChild(
                card
            );

        }
    );


    console.log(
        `✅ ${unitsData.length} units displayed`
    );

}


// =====================================================
// START UNIT QUIZ
// =====================================================

window.startUnitQuiz =
function(unitId) {

    const unit =
        unitsData.find(
            item =>
                Number(item.id) ===
                Number(unitId)
        );


    if (!unit) {

        alert(
            "Unit could not be found."
        );

        return;

    }


    const unitTitle =
        unit.title;


    saveCourseSelection(
        courseId,
        courseName
    );


    localStorage.setItem(
        "selectedUnit",
        String(unit.id)
    );


    localStorage.setItem(
        "selectedUnitTitle",
        unitTitle
    );


    localStorage.setItem(
        "selectedCourseName",
        courseName
    );


    console.log(
        "📝 Starting quiz:",
        {
            courseId,
            unitId: unit.id,
            unitTitle
        }
    );


    const quizURL =
        `quiz.html?course=${encodeURIComponent(
            courseId
        )}` +
        `&unit_id=${encodeURIComponent(
            unit.id
        )}` +
        `&unit=${encodeURIComponent(
            unitTitle
        )}`;


    window.location.href =
        quizURL;

};


// Compatibility with older code
window.startQuiz =
function(
    selectedCourseId,
    unitId,
    unitTitle
) {

    const actualCourseId =
        Number(
            selectedCourseId ||
            courseId
        );


    localStorage.setItem(
        "selectedCourse",
        String(actualCourseId)
    );


    localStorage.setItem(
        "selectedUnit",
        String(unitId)
    );


    localStorage.setItem(
        "selectedUnitTitle",
        unitTitle || ""
    );


    localStorage.setItem(
        "selectedCourseName",
        courseName
    );


    window.location.href =
        `quiz.html?course=${encodeURIComponent(
            actualCourseId
        )}` +
        `&unit_id=${encodeURIComponent(
            unitId
        )}` +
        `&unit=${encodeURIComponent(
            unitTitle || ""
        )}`;

};


// =====================================================
// SHOW UNIT NOTES
// =====================================================

window.showUnitNotes =
async function(unitId) {

    const unit =
        unitsData.find(
            item =>
                Number(item.id) ===
                Number(unitId)
        );


    if (!unit) {

        alert(
            "Unit could not be found."
        );

        return;

    }


    console.log(
        "📄 Loading notes:",
        unit.title
    );


    // -------------------------------------------------
    // FIRST: USE notes_content
    // -------------------------------------------------

    if (
        unit.notes_content &&
        String(
            unit.notes_content
        ).trim()
    ) {

        displayNotesModal(
            unit.title,
            unit.notes_content
        );

        return;

    }


    // -------------------------------------------------
    // SECOND: CHECK notes TABLE
    // -------------------------------------------------

    try {

        const {
            data,
            error
        } = await supabase

            .from("notes")

            .select(`
                id,
                course,
                unit,
                file_name,
                file_url,
                created_at,
                uploaded_by,
                course_id,
                unit_id
            `)

            .eq(
                "course_id",
                courseId
            )

            .eq(
                "unit_id",
                unit.id
            )

            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (
            !error &&
            data &&
            data.length > 0
        ) {

            displayNotesModal(
                unit.title,
                "",
                data
            );

            return;

        }


        // -------------------------------------------------
        // FALLBACK: COURSE + UNIT TITLE
        // -------------------------------------------------

        const {
            data: fallbackData,
            error: fallbackError
        } = await supabase

            .from("notes")

            .select(`
                id,
                course,
                unit,
                file_name,
                file_url,
                created_at,
                uploaded_by,
                course_id,
                unit_id
            `)

            .eq(
                "course_id",
                courseId
            )

            .eq(
                "unit",
                unit.title
            )

            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (
            !fallbackError &&
            fallbackData &&
            fallbackData.length > 0
        ) {

            displayNotesModal(
                unit.title,
                "",
                fallbackData
            );

            return;

        }


        displayNotesModal(
            unit.title,
            unit.notes ||
            "No notes have been uploaded for this unit yet."
        );

    } catch (error) {

        console.error(
            "❌ Notes error:",
            error
        );


        displayNotesModal(
            unit.title,
            unit.notes ||
            "Unable to load notes."
        );

    }

};


// =====================================================
// NOTES MODAL
// =====================================================

function displayNotesModal(
    title,
    content = "",
    files = []
) {

    const oldModal =
        document.getElementById(
            "unitNotesModal"
        );


    if (oldModal) {
        oldModal.remove();
    }


    const modal =
        document.createElement(
            "div"
        );


    modal.id =
        "unitNotesModal";


    modal.className =
        "notes-modal";


    let filesHTML = "";


    if (
        Array.isArray(files) &&
        files.length > 0
    ) {

        filesHTML = `

            <div class="uploaded-notes">

                <h3>
                    📚 Uploaded Notes
                </h3>

                ${files.map(file => `

                    <div class="note-file">

                        <span>
                            📄
                            ${escapeHTML(
                                file.file_name ||
                                "Notes"
                            )}
                        </span>

                        ${
                            file.file_url
                                ? `
                                    <a
                                        href="${escapeHTML(
                                            file.file_url
                                        )}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Open
                                    </a>
                                  `
                                : ""
                        }

                    </div>

                `).join("")}

            </div>

        `;

    }


    modal.innerHTML = `

        <div class="notes-modal-overlay"
             onclick="closeNotesModal()">

            <div
                class="notes-modal-content"
                onclick="event.stopPropagation()"
            >

                <button
                    class="notes-close"
                    onclick="closeNotesModal()"
                >
                    ✕
                </button>


                <h2>
                    📄 ${escapeHTML(title)}
                </h2>


                ${
                    content
                        ? `
                            <div class="notes-body">
                                ${formatNotes(
                                    content
                                )}
                            </div>
                          `
                        : ""
                }


                ${filesHTML}

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );

}


// =====================================================
// FORMAT NOTES
// =====================================================

function formatNotes(
    text
) {

    const safe =
        escapeHTML(text);


    return safe
        .replace(
            /\n\n+/g,
            "</p><p>"
        )
        .replace(
            /\n/g,
            "<br>"
        )
        .replace(
            /^/,
            "<p>"
        )
        .replace(
            /$/,
            "</p>"
        );

}


// =====================================================
// CLOSE NOTES
// =====================================================

window.closeNotesModal =
function() {

    const modal =
        document.getElementById(
            "unitNotesModal"
        );


    if (modal) {
        modal.remove();
    }

};


// =====================================================
// COURSE ERROR
// =====================================================

function showCourseError(
    message
) {

    const area =
        getCourseArea();


    if (!area) {
        return;
    }


    area.innerHTML = `

        <div class="course-error">

            <div style="font-size:60px;">
                ⚠️
            </div>

            <h2>
                Unable to Load Course
            </h2>

            <p>
                ${escapeHTML(message)}
            </p>

            <button
                onclick="location.reload()"
            >
                🔄 Try Again
            </button>

            <button
                onclick="location.href='courses.html'"
            >
                📚 Back to Courses
            </button>

        </div>

    `;

}


// =====================================================
// INITIALIZE
// =====================================================

async function initializeCourse() {

    console.log(
        "🚀 Initializing Mwaniki Scholars course page..."
    );


    await loadCourse();

}


// =====================================================
// START
// =====================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeCourse
    );

} else {

    initializeCourse();

}


console.log(
    "✅ Course engine ready"
);
