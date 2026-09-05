import { supabase } from "./supabase.js";

// ============================================================
// MWANIKI SCHOLARS
// CLEAN COURSE PAGE ENGINE
// ============================================================

console.log("📚 Mwaniki Scholars Course Engine Loaded");

// ============================================================
// SELECTED COURSE
// ============================================================

const courseId = localStorage.getItem("selectedCourse");
const courseName = localStorage.getItem("selectedCourseName");

// ============================================================
// PAGE ELEMENTS
// ============================================================

const courseTitle = document.getElementById("courseTitle");
const courseDescription = document.getElementById("courseDescription");
const unitsArea = document.getElementById("unitsArea");
const notesArea = document.getElementById("notesArea");

console.log("📚 Selected Course ID:", courseId);
console.log("📚 Selected Course Name:", courseName);

// ============================================================
// ESCAPE HTML
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

    const url = String(value).trim();

    return (
        url.startsWith("https://") ||
        url.startsWith("http://")
    );

}

// ============================================================
// GET UNIT NOTES
// ============================================================

function getUnitNotes(unit) {

    if (!unit) {
        return "";
    }

    // Preferred column
    if (
        unit.notes_content &&
        String(unit.notes_content).trim() !== ""
    ) {
        return String(unit.notes_content);
    }

    // Older notes column
    if (
        unit.notes &&
        String(unit.notes).trim() !== ""
    ) {
        return String(unit.notes);
    }

    return "";

}

// ============================================================
// FORMAT NOTES
// ============================================================

function formatDetailedNotes(content) {

    if (!content) {
        return "";
    }

    let text = escapeHTML(content);

    // Headings
    text = text.replace(
        /^### (.*)$/gm,
        "<h4>$1</h4>"
    );

    text = text.replace(
        /^## (.*)$/gm,
        "<h3>$1</h3>"
    );

    text = text.replace(
        /^# (.*)$/gm,
        "<h2>$1</h2>"
    );

    // Bold
    text = text.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    // Italics
    text = text.replace(
        /\*(.*?)\*/g,
        "<em>$1</em>"
    );

    // Horizontal rules
    text = text.replace(
        /^---$/gm,
        "<hr>"
    );

    // Bullets
    text = text.replace(
        /^\s*[-•]\s+(.*)$/gm,
        "<li>$1</li>"
    );

    // Numbered lists
    text = text.replace(
        /^\s*\d+\.\s+(.*)$/gm,
        "<li>$1</li>"
    );

    // Wrap consecutive list items
    text = text.replace(
        /((?:<li>.*?<\/li>\s*)+)/gs,
        "<ul>$1</ul>"
    );

    // Line breaks
    text = text.replace(
        /\n{2,}/g,
        "<br><br>"
    );

    text = text.replace(
        /\n/g,
        "<br>"
    );

    return text;

}

// ============================================================
// LOAD COURSE
// ============================================================

async function loadCourse() {

    if (!courseId) {
        return;
    }

    try {

        console.log(
            "🔎 Loading course:",
            courseId
        );

        const {
            data,
            error
        } = await supabase
            .from("courses")
            .select("*")
            .eq("id", Number(courseId))
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

        // Course title

        if (courseTitle) {

            courseTitle.textContent =
                data.title ||
                courseName ||
                "Course";

        }

        // Course description

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
            "❌ #unitsArea was not found."
        );

        return;

    }

    // Loading state

    unitsArea.innerHTML = `
        <div class="loading">
            ⏳ Loading units...
        </div>
    `;

    try {

        console.log(
            "🔎 Loading units from Supabase..."
        );

        /*
         * IMPORTANT:
         *
         * We deliberately retrieve notes_content here only
         * so that notes can be opened later.
         *
         * We DO NOT render notes_content inside the card.
         */

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

        // No units

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
            <div class="error">

                <h3>
                    ❌ Unable to Load Units
                </h3>

                <p>
                    ${escapeHTML(error.message)}
                </p>

            </div>
        `;

    }

}

// ============================================================
// RENDER CLEAN UNIT CARDS
// ============================================================

function renderUnits(units) {

    if (!unitsArea) {
        return;
    }

    // Completely clear previous content

    unitsArea.innerHTML = "";

    units.forEach(
        (unit, index) => {

            const unitCard =
                document.createElement("article");

            unitCard.className =
                "unit-card";

            // =================================================
            // IMAGE
            // =================================================

            let imageHTML = "";

            if (
                isValidURL(unit.image)
            ) {

                imageHTML = `
                    <div class="unit-image">

                        <img
                            src="${escapeHTML(unit.image)}"
                            alt="${escapeHTML(unit.title)}"
                            loading="lazy"
                            onerror="
                                this.parentElement.remove();
                            "
                        >

                    </div>
                `;

            }

            // =================================================
            // VIDEO
            // =================================================

            let videoHTML = "";

            if (
                isValidURL(unit.video_url)
            ) {

                videoHTML = `
                    <div class="unit-video">

                        <video
                            controls
                            preload="metadata"
                            width="100%"
                        >

                            <source
                                src="${escapeHTML(unit.video_url)}"
                            >

                            Your browser does not
                            support video playback.

                        </video>

                    </div>
                `;

            }

            // =================================================
            // NOTES STATUS
            // =================================================

            const notes =
                getUnitNotes(unit);

            const notesAvailable =
                notes.trim() !== "";

            // =================================================
            // CLEAN CARD
            // =================================================
            //
            // VERY IMPORTANT:
            //
            // notes_content IS NOT placed here.
            //
            // This prevents Markdown and long notes from
            // appearing inside the course cards.
            //

            unitCard.innerHTML = `

                <div class="unit-header">

                    <div class="unit-number">

                        Unit ${index + 1}

                    </div>

                    <h3 class="unit-title">

                        ${escapeHTML(unit.title)}

                    </h3>

                </div>

                ${imageHTML}

                ${videoHTML}

                <div class="unit-actions">

                    <button
                        type="button"
                        class="quiz-btn quiz-button"
                        data-unit-id="${escapeHTML(unit.id)}"
                        data-unit-title="${escapeHTML(unit.title)}"
                    >

                        📝 Start Quiz

                    </button>

                    <button
                        type="button"
                        class="notes-btn notes-button"
                        data-unit-id="${escapeHTML(unit.id)}"
                        data-unit-title="${escapeHTML(unit.title)}"
                    >

                        📄 View Notes

                    </button>

                </div>

                <div class="notes-status">

                    ${
                        notesAvailable
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

    unitsArea
        .querySelectorAll(".quiz-button")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        const selectedUnitId =
                            this.dataset.unitId;

                        const selectedUnitTitle =
                            this.dataset.unitTitle;

                        console.log(
                            "📝 Starting Supabase quiz:",
                            {
                                courseId,
                                unitId:
                                    selectedUnitId,
                                unitTitle:
                                    selectedUnitTitle
                            }
                        );

                        // Save course

                        localStorage.setItem(
                            "selectedCourse",
                            String(courseId)
                        );

                        localStorage.setItem(
                            "selectedCourseName",
                            courseName || ""
                        );

                        // Save unit

                        localStorage.setItem(
                            "selectedUnit",
                            String(selectedUnitId)
                        );

                        localStorage.setItem(
                            "selectedUnitTitle",
                            selectedUnitTitle
                        );

                        // =================================================
                        // IMPORTANT QUIZ URL
                        // =================================================

                        const quizURL =
                            `./quiz.html?course=${encodeURIComponent(
                                courseId
                            )}` +
                            `&unit_id=${encodeURIComponent(
                                selectedUnitId
                            )}` +
                            `&unit=${encodeURIComponent(
                                selectedUnitTitle
                            )}`;

                        console.log(
                            "➡️ Opening Supabase quiz:",
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

    unitsArea
        .querySelectorAll(".notes-button")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async function () {

                        const selectedUnitId =
                            this.dataset.unitId;

                        const selectedUnitTitle =
                            this.dataset.unitTitle;

                        console.log(
                            "📄 Opening notes:",
                            selectedUnitTitle,
                            selectedUnitId
                        );

                        await showUnitNotes(
                            Number(selectedUnitId),
                            selectedUnitTitle
                        );

                    }
                );

            }
        );

    console.log(
        `✅ ${units.length} clean unit cards displayed`
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
            "❌ #notesArea was not found."
        );

        return;

    }

    // Loading

    notesArea.innerHTML = `
        <div class="loading">

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
        // FIRST: GET UNIT NOTES
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
        // DIRECT NOTES
        // ====================================================

        if (unit) {

            const directNotes =
                getUnitNotes(unit);

            if (
                directNotes &&
                directNotes.trim() !== ""
            ) {

                console.log(
                    "✅ Direct unit notes found."
                );

                renderDetailedNotes(
                    unit.title || unitTitle,
                    directNotes
                );

                return;

            }

        }

        // ====================================================
        // SECOND: NOTES TABLE
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

        }

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
        // THIRD: TEXT FALLBACK
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

            <section class="empty-notes">

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
                        ${escapeHTML(unitTitle)}
                    </strong>.

                </p>

                <p class="notes-help">

                    Notes uploaded by the administrator
                    will appear here automatically.

                </p>

            </section>

        `;

    }

    catch (error) {

        console.error(
            "❌ Failed to load notes:",
            error
        );

        notesArea.innerHTML = `

            <section class="error-notes">

                <div class="error-icon">
                    ❌
                </div>

                <h2>
                    Unable to Load Notes
                </h2>

                <p>
                    ${escapeHTML(error.message)}
                </p>

                <button
                    type="button"
                    id="retryNotesButton"
                >

                    🔄 Try Again

                </button>

            </section>

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
                        ${escapeHTML(unitTitle)}
                    </h2>

                    <p>
                        Detailed Course Notes
                    </p>

                </div>

            </div>

            <div class="notes-content">

                ${formatDetailedNotes(notesContent)}

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

    let cards = "";

    uploadedNotes.forEach(
        note => {

            if (
                !isValidURL(note.file_url)
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

                <div class="uploaded-note-card">

                    <div class="uploaded-note-icon">
                        📄
                    </div>

                    <div class="uploaded-note-info">

                        <h3>
                            ${escapeHTML(fileName)}
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

                    <div class="uploaded-note-action">

                        <a
                            href="${escapeHTML(note.file_url)}"
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

    if (!cards) {

        notesArea.innerHTML = `

            <section class="empty-notes">

                <h2>
                    📚 No Notes Available
                </h2>

                <p>
                    No readable note files were found.
                </p>

            </section>

        `;

        return;

    }

    notesArea.innerHTML = `

        <section class="course-notes">

            <div class="notes-header">

                <span class="notes-icon">
                    📚
                </span>

                <div>

                    <h2>
                        ${escapeHTML(unitTitle)}
                    </h2>

                    <p>
                        Course Notes & Study Materials
                    </p>

                </div>

            </div>

            <div class="uploaded-notes-list">

                ${cards}

            </div>

        </section>

    `;

}

// ============================================================
// GLOBAL NOTES ACCESS
// ============================================================

window.showUnitNotes = showUnitNotes;

// ============================================================
// INITIALIZE COURSE PAGE
// ============================================================

async function initializeCoursePage() {

    console.log(
        "🚀 Initializing Mwaniki Scholars Course Page..."
    );

    // ========================================================
    // NO COURSE SELECTED
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
