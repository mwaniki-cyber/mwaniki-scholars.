import { supabase } from "./supabase.js";

// ============================================================
// MWANIKI SCHOLARS
// COURSE PAGE ENGINE
// ============================================================

console.log(
    "📚 Mwaniki Scholars Course Engine Loaded"
);


// ============================================================
// SELECTED COURSE
// ============================================================

const courseId =
    localStorage.getItem(
        "selectedCourse"
    );


const courseName =
    localStorage.getItem(
        "selectedCourseName"
    );


// ============================================================
// PAGE ELEMENTS
// ============================================================

const courseTitle =
    document.getElementById(
        "courseTitle"
    );


const courseDescription =
    document.getElementById(
        "courseDescription"
    );


const unitsArea =
    document.getElementById(
        "unitsArea"
    );


const notesArea =
    document.getElementById(
        "notesArea"
    );


console.log(
    "📚 Selected Course ID:",
    courseId
);


console.log(
    "📚 Selected Course Name:",
    courseName
);


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ============================================================
// VALID URL
// ============================================================

function isValidURL(value) {

    if (!value) {
        return false;
    }


    const valueString =
        String(value).trim();


    return (
        valueString.startsWith(
            "https://"
        ) ||
        valueString.startsWith(
            "http://"
        )
    );

}


// ============================================================
// FORMAT NOTES
// ============================================================

function formatDetailedNotes(
    content
) {

    if (!content) {
        return "";
    }


    let text =
        escapeHTML(content);


    // ========================================================
    // HEADINGS
    // ========================================================

    text =
        text.replace(
            /^### (.*)$/gm,
            "<h4>$1</h4>"
        );


    text =
        text.replace(
            /^## (.*)$/gm,
            "<h3>$1</h3>"
        );


    text =
        text.replace(
            /^# (.*)$/gm,
            "<h2>$1</h2>"
        );


    // ========================================================
    // BOLD
    // ========================================================

    text =
        text.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );


    // ========================================================
    // ITALICS
    // ========================================================

    text =
        text.replace(
            /\*(.*?)\*/g,
            "<em>$1</em>"
        );


    // ========================================================
    // HORIZONTAL RULE
    // ========================================================

    text =
        text.replace(
            /^---$/gm,
            "<hr>"
        );


    // ========================================================
    // BULLETS
    // ========================================================

    text =
        text.replace(
            /^\s*[-•]\s+(.*)$/gm,
            "<li>$1</li>"
        );


    // ========================================================
    // NUMBERED LIST
    // ========================================================

    text =
        text.replace(
            /^\s*\d+\.\s+(.*)$/gm,
            "<li>$1</li>"
        );


    // ========================================================
    // WRAP LIST ITEMS
    // ========================================================

    text =
        text.replace(
            /((?:<li>.*?<\/li>\s*)+)/gs,
            "<ul>$1</ul>"
        );


    // ========================================================
    // LINE BREAKS
    // ========================================================

    text =
        text.replace(
            /\n{2,}/g,
            "<br><br>"
        );


    text =
        text.replace(
            /\n/g,
            "<br>"
        );


    return text;

}


// ============================================================
// GET UNIT NOTES
// ============================================================

function getUnitNotes(
    unit
) {

    if (!unit) {
        return "";
    }


    // ========================================================
    // PREFERRED NOTES
    // ========================================================

    if (
        unit.notes_content &&
        String(
            unit.notes_content
        ).trim() !== ""
    ) {

        return unit.notes_content;

    }


    // ========================================================
    // OLD NOTES COLUMN
    // ========================================================

    if (
        unit.notes &&
        String(
            unit.notes
        ).trim() !== ""
    ) {

        return unit.notes;

    }


    return "";

}


// ============================================================
// LOAD COURSE
// ============================================================

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

            .eq(
                "id",
                Number(courseId)
            )

            .single();


        if (error) {

            console.error(
                "❌ Course loading error:",
                error
            );

            throw error;
        }


        if (!data) {

            throw new Error(
                "Course not found."
            );

        }


        console.log(
            "✅ Course loaded:",
            data
        );


        // ====================================================
        // TITLE
        // ====================================================

        if (courseTitle) {

            courseTitle.textContent =
                data.title ||
                courseName ||
                "Course";

        }


        // ====================================================
        // DESCRIPTION
        // ====================================================

        if (courseDescription) {

            courseDescription.textContent =
                data.description ||
                "Medical learning course";

        }

    }

    catch (error) {

        console.error(
            "❌ Failed to load course:",
            error
        );


        if (courseTitle) {

            courseTitle.textContent =
                "Unable to Load Course";

        }


        if (courseDescription) {

            courseDescription.textContent =
                "There was a problem loading this course.";

        }

    }

}


// ============================================================
// LOAD UNITS
// ============================================================

async function loadUnits() {

    if (!courseId) {
        return;
    }


    if (!unitsArea) {

        console.error(
            "❌ #unitsArea not found."
        );

        return;
    }


    // ========================================================
    // LOADING
    // ========================================================

    unitsArea.innerHTML = `

        <div class="loading-state">

            ⏳ Loading units...

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
                Number(courseId)
            )

            .order(
                "id",
                {
                    ascending: true
                }
            );


        if (error) {

            console.error(
                "❌ Units loading error:",
                error
            );

            throw error;
        }


        console.log(
            "📖 Units loaded:",
            data
        );


        // ====================================================
        // NO UNITS
        // ====================================================

        if (
            !data ||
            data.length === 0
        ) {

            unitsArea.innerHTML = `

                <div class="empty-state">

                    <h3>
                        📚 No Units Available
                    </h3>

                    <p>
                        This course does not have
                        any units yet.
                    </p>

                </div>

            `;

            return;
        }


        renderUnits(data);

    }

    catch (error) {

        console.error(
            "❌ Failed to load units:",
            error
        );


        unitsArea.innerHTML = `

            <div class="error-state">

                <h3>
                    ❌ Unable to Load Units
                </h3>

                <p>
                    ${escapeHTML(
                        error.message
                    )}
                </p>

            </div>

        `;

    }

}


// ============================================================
// RENDER UNITS
// ============================================================

function renderUnits(
    units
) {

    unitsArea.innerHTML = "";


    units.forEach(
        (unit, index) => {

            const unitCard =
                document.createElement(
                    "div"
                );


            unitCard.className =
                "unit-card";


            const unitNotes =
                getUnitNotes(unit);


            const hasNotes =
                Boolean(
                    unitNotes
                );


            // =================================================
            // SAFE IMAGE
            // =================================================

            let imageHTML = "";


            if (
                isValidURL(
                    unit.image
                )
            ) {

                imageHTML = `

                    <div class="unit-image">

                        <img
                            src="${escapeHTML(
                                unit.image
                            )}"
                            alt="${escapeHTML(
                                unit.title
                            )}"
                            loading="lazy"
                            onerror="
                                this.parentElement.style.display='none';
                            "
                        >

                    </div>

                `;

            }


            // =================================================
            // SAFE VIDEO
            // =================================================

            let videoHTML = "";


            if (
                isValidURL(
                    unit.video_url
                )
            ) {

                videoHTML = `

                    <div class="unit-video">

                        <video
                            controls
                            preload="metadata"
                            width="100%"
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

                `;

            }


            // =================================================
            // CARD
            // =================================================

            unitCard.innerHTML = `

                <div class="unit-header">

                    <div class="unit-number">

                        Unit ${index + 1}

                    </div>


                    <h3 class="unit-title">

                        ${escapeHTML(
                            unit.title
                        )}

                    </h3>

                </div>


                ${imageHTML}


                ${videoHTML}


                <div class="unit-actions">

                    <button
                        type="button"
                        class="quiz-button"
                        data-unit-id="${escapeHTML(
                            unit.id
                        )}"
                        data-unit-title="${escapeHTML(
                            unit.title
                        )}"
                    >

                        📝 Start Quiz

                    </button>


                    <button
                        type="button"
                        class="notes-button"
                        data-unit-id="${escapeHTML(
                            unit.id
                        )}"
                        data-unit-title="${escapeHTML(
                            unit.title
                        )}"
                    >

                        📄 View Notes

                    </button>

                </div>


                <div class="notes-status">

                    ${
                        hasNotes
                            ? "✅ Detailed notes available"
                            : "📚 Study materials available"
                    }

                </div>

            `;


            unitsArea.appendChild(
                unitCard
            );

        }
    );


    // ========================================================
    // QUIZ BUTTONS
    // ========================================================

    document
        .querySelectorAll(
            ".quiz-button"
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
                            "📝 Starting Supabase quiz:",
                            {
                                courseId:
                                    courseId,

                                unitId:
                                    unitId,

                                unitTitle:
                                    unitTitle
                            }
                        );


                        // =====================================
                        // SAVE SELECTION
                        // =====================================

                        localStorage.setItem(
                            "selectedCourse",
                            courseId
                        );


                        localStorage.setItem(
                            "selectedCourseName",
                            courseName || ""
                        );


                        localStorage.setItem(
                            "selectedUnit",
                            unitId
                        );


                        localStorage.setItem(
                            "selectedUnitTitle",
                            unitTitle
                        );


                        // =====================================
                        // QUIZ URL
                        // =====================================

                        const quizURL =
                            `quiz.html?course=${encodeURIComponent(
                                courseId
                            )}` +
                            `&unit_id=${encodeURIComponent(
                                unitId
                            )}` +
                            `&unit=${encodeURIComponent(
                                unitTitle
                            )}`;


                        console.log(
                            "➡️ Opening:",
                            quizURL
                        );


                        window.location.href =
                            quizURL;

                    }
                );

            }
        );


    // ========================================================
    // NOTES BUTTONS
    // ========================================================

    document
        .querySelectorAll(
            ".notes-button"
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
                            "📄 Opening notes:",
                            unitTitle,
                            unitId
                        );


                        await showUnitNotes(
                            Number(unitId),
                            unitTitle
                        );

                    }
                );

            }
        );


    console.log(
        `✅ ${units.length} units displayed`
    );

}


// ============================================================
// SHOW UNIT NOTES
// ============================================================

async function showUnitNotes(
    unitId,
    unitTitle
) {

    if (!notesArea) {

        console.error(
            "❌ #notesArea not found."
        );

        return;
    }


    // ========================================================
    // LOADING
    // ========================================================

    notesArea.innerHTML = `

        <div class="loading-state">

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

        // ====================================================
        // STEP 1 — UNIT
        // ====================================================

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
                Number(unitId)
            )

            .single();


        if (unitError) {

            console.warn(
                "⚠️ Unit notes query:",
                unitError
            );

        }


        // ====================================================
        // DIRECT UNIT NOTES
        // ====================================================

        if (unit) {

            const directNotes =
                getUnitNotes(unit);


            if (
                directNotes &&
                String(
                    directNotes
                ).trim() !== ""
            ) {

                console.log(
                    "✅ Direct unit notes found."
                );


                renderDetailedNotes(
                    unit.title ||
                    unitTitle,

                    directNotes
                );


                return;
            }

        }


        // ====================================================
        // STEP 2 — NOTES TABLE
        // ====================================================

        console.log(
            "🔎 Searching public.notes..."
        );


        const {
            data: uploadedNotes,
            error: notesError
        } = await supabase

            .from("notes")

            .select(`
                id,
                file_name,
                file_url,
                course,
                unit,
                course_id,
                unit_id,
                created_at
            `)

            .eq(
                "course_id",
                Number(courseId)
            )

            .eq(
                "unit_id",
                Number(unitId)
            )

            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (notesError) {

            console.error(
                "❌ Uploaded notes error:",
                notesError
            );

            throw notesError;
        }


        console.log(
            "📦 Uploaded notes:",
            uploadedNotes
        );


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


        // ====================================================
        // STEP 3 — TEXT FALLBACK
        // ====================================================

        console.log(
            "🔎 Trying text-based notes search..."
        );


        const {
            data: fallbackNotes,
            error: fallbackError
        } = await supabase

            .from("notes")

            .select(`
                id,
                file_name,
                file_url,
                course,
                unit,
                course_id,
                unit_id,
                created_at
            `)

            .eq(
                "course_id",
                Number(courseId)
            )

            .eq(
                "unit",
                unitTitle
            )

            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (fallbackError) {

            console.warn(
                "⚠️ Text notes search:",
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


        // ====================================================
        // NO NOTES
        // ====================================================

        notesArea.innerHTML = `

            <div class="empty-notes">

                <div class="empty-notes-icon">
                    📚
                </div>


                <h2>
                    No Notes Found
                </h2>


                <p>

                    There are currently no notes
                    available for

                    <strong>
                        ${escapeHTML(
                            unitTitle
                        )}
                    </strong>.

                </p>


                <p class="notes-help">

                    Notes uploaded by the administrator
                    will appear here automatically.

                </p>

            </div>

        `;

    }

    catch (error) {

        console.error(
            "❌ Failed to load notes:",
            error
        );


        notesArea.innerHTML = `

            <div class="error-notes">

                <div class="error-icon">
                    ❌
                </div>


                <h2>
                    Unable to Load Notes
                </h2>


                <p>
                    ${escapeHTML(
                        error.message
                    )}
                </p>


                <button
                    type="button"
                    id="retryNotesButton"
                >

                    🔄 Try Again

                </button>

            </div>

        `;


        const retry =
            document.getElementById(
                "retryNotesButton"
            );


        if (retry) {

            retry.addEventListener(
                "click",
                function () {

                    showUnitNotes(
                        unitId,
                        unitTitle
                    );

                }
            );

        }

    }

}


// ============================================================
// RENDER DETAILED NOTES
// ============================================================

function renderDetailedNotes(
    unitTitle,
    notesContent
) {

    if (!notesArea) {
        return;
    }


    notesArea.innerHTML = `

        <section class="course-notes">

            <div class="notes-header">

                <span class="notes-icon">
                    📖
                </span>


                <div>

                    <h2>
                        ${escapeHTML(
                            unitTitle
                        )}
                    </h2>


                    <p>
                        Detailed Course Notes
                    </p>

                </div>

            </div>


            <div class="notes-content">

                ${formatDetailedNotes(
                    notesContent
                )}

            </div>

        </section>

    `;

}


// ============================================================
// RENDER UPLOADED NOTES
// ============================================================

function renderUploadedNotes(
    unitTitle,
    uploadedNotes
) {

    if (!notesArea) {
        return;
    }


    console.log(
        "📚 Rendering uploaded notes:",
        uploadedNotes
    );


    let cards = "";


    uploadedNotes.forEach(
        note => {

            if (
                !isValidURL(
                    note.file_url
                )
            ) {

                return;

            }


            const fileName =
                note.file_name ||
                "Course Notes";


            const fileExtension =
                fileName
                    .split(".")
                    .pop()
                    .toUpperCase();


            const createdDate =
                note.created_at
                    ? new Date(
                        note.created_at
                    ).toLocaleDateString()
                    : "";


            cards += `

                <div
                    class="uploaded-note-card"
                >

                    <div
                        class="uploaded-note-icon"
                    >
                        📄
                    </div>


                    <div
                        class="uploaded-note-info"
                    >

                        <h3>

                            ${escapeHTML(
                                fileName
                            )}

                        </h3>


                        <p>

                            ${escapeHTML(
                                fileExtension
                            )}

                            ${
                                createdDate
                                    ? ` • Uploaded ${escapeHTML(
                                        createdDate
                                    )}`
                                    : ""
                            }

                        </p>

                    </div>


                    <div
                        class="uploaded-note-action"
                    >

                        <a
                            href="${escapeHTML(
                                note.file_url
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="open-notes-link"
                        >

                            📖 Open Notes

                        </a>

                    </div>

                </div>

            `;

        }
    );


    // ========================================================
    // NOTHING READABLE
    // ========================================================

    if (!cards) {

        notesArea.innerHTML = `

            <div class="empty-notes">

                <h2>
                    📚 No Notes Available
                </h2>

                <p>
                    No readable note files were found.
                </p>

            </div>

        `;

        return;
    }


    // ========================================================
    // DISPLAY
    // ========================================================

    notesArea.innerHTML = `

        <section class="course-notes">

            <div class="notes-header">

                <span class="notes-icon">
                    📚
                </span>


                <div>

                    <h2>
                        ${escapeHTML(
                            unitTitle
                        )}
                    </h2>


                    <p>
                        Course Notes & Study Materials
                    </p>

                </div>

            </div>


            <div
                class="uploaded-notes-list"
            >

                ${cards}

            </div>

        </section>

    `;

}


// ============================================================
// GLOBAL NOTES ACCESS
// ============================================================

window.showUnitNotes =
    showUnitNotes;


// ============================================================
// INITIALIZE COURSE PAGE
// ============================================================

async function initializeCoursePage() {

    console.log(
        "🚀 Initializing Mwaniki Scholars Course Page..."
    );


    // ========================================================
    // NO COURSE
    // ========================================================

    if (!courseId) {

        console.error(
            "❌ No selected course found."
        );


        if (courseTitle) {

            courseTitle.textContent =
                "Course Not Found";

        }


        if (courseDescription) {

            courseDescription.textContent =
                "Please return to the courses page and select a course.";

        }


        if (unitsArea) {

            unitsArea.innerHTML = `

                <div class="empty-state">

                    <h3>
                        ⚠️ No Course Selected
                    </h3>

                    <p>
                        Please return to the courses
                        page and select a course.
                    </p>

                </div>

            `;

        }


        return;
    }


    // ========================================================
    // LOAD COURSE
    // ========================================================

    await loadCourse();


    // ========================================================
    // LOAD UNITS
    // ========================================================

    await loadUnits();


    console.log(
        "✅ Course page fully initialized."
    );

}


// ============================================================
// START
// ============================================================

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeCoursePage
    );

}

else {

    initializeCoursePage();

}
