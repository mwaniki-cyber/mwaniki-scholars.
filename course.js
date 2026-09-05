import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS - COURSE ENGINE
// =====================================================

console.log("📚 Mwaniki Scholars Course Engine Loaded");

// =====================================================
// GET COURSE DATA
// =====================================================

const courseId = localStorage.getItem("selectedCourse");
const courseName = localStorage.getItem("selectedCourseName");

const courseTitle = document.getElementById("courseTitle");
const courseDescription = document.getElementById("courseDescription");
const unitsArea = document.getElementById("unitsArea");
const notesArea = document.getElementById("notesArea");

// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =====================================================
// LOAD COURSE
// =====================================================

async function loadCourse() {
    if (!courseId) {
        console.error("❌ No selected course found.");

        if (courseTitle) {
            courseTitle.textContent = "Course Not Found";
        }

        if (courseDescription) {
            courseDescription.textContent =
                "No course was selected. Please return to the courses page.";
        }

        return;
    }

    const numericCourseId = Number(courseId);

    if (!Number.isInteger(numericCourseId)) {
        console.error("❌ Invalid course ID:", courseId);

        if (courseTitle) {
            courseTitle.textContent = "Invalid Course";
        }

        return;
    }

    console.log("🔎 Loading course:", numericCourseId);

    const { data, error } = await supabase
        .from("courses")
        .select("id, title, description, image, created_at")
        .eq("id", numericCourseId)
        .maybeSingle();

    if (error) {
        console.error("❌ Course loading error:", error);

        if (courseTitle) {
            courseTitle.textContent = "Unable to Load Course";
        }

        if (courseDescription) {
            courseDescription.textContent =
                "There was a problem loading this course.";
        }

        return;
    }

    if (!data) {
        console.error("❌ Course not found:", numericCourseId);

        if (courseTitle) {
            courseTitle.textContent = "Course Not Found";
        }

        if (courseDescription) {
            courseDescription.textContent =
                "This course does not exist in the database.";
        }

        return;
    }

    console.log("✅ Course loaded:", data);

    if (courseTitle) {
        courseTitle.textContent = data.title || courseName || "Course";
    }

    if (courseDescription) {
        courseDescription.textContent =
            data.description || "No course description available.";
    }

    // Save the correct course information
    localStorage.setItem("selectedCourse", String(data.id));
    localStorage.setItem("selectedCourseName", data.title || "");
}

// =====================================================
// LOAD UNITS
// =====================================================

async function loadUnits() {
    if (!courseId) {
        console.error("❌ Cannot load units: no course ID.");
        return;
    }

    const numericCourseId = Number(courseId);

    if (!Number.isInteger(numericCourseId)) {
        console.error("❌ Invalid course ID:", courseId);
        return;
    }

    if (!unitsArea) {
        console.error("❌ unitsArea was not found.");
        return;
    }

    unitsArea.innerHTML = `
        <div class="loading">
            <h3>📚 Loading Units...</h3>
            <p>Please wait.</p>
        </div>
    `;

    console.log("🔎 Loading units for course:", numericCourseId);

    const { data: units, error } = await supabase
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
        .eq("course_id", numericCourseId)
        .order("id", { ascending: true });

    if (error) {
        console.error("❌ Units loading error:", error);

        unitsArea.innerHTML = `
            <div class="error-message">
                <h3>❌ Unable to Load Units</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;

        return;
    }

    if (!units || units.length === 0) {
        console.warn(
            "⚠️ No units found for course:",
            numericCourseId
        );

        unitsArea.innerHTML = `
            <div class="empty-message">
                <h3>📚 No Units Available</h3>
                <p>This course does not have any units yet.</p>
            </div>
        `;

        return;
    }

    console.log(
        `✅ Loaded ${units.length} units for course ${numericCourseId}`
    );

    renderUnits(units);
}

// =====================================================
// RENDER UNITS
// =====================================================

function renderUnits(units) {
    if (!unitsArea) return;

    unitsArea.innerHTML = "";

    units.forEach((unit, index) => {
        const unitId = unit.id;
        const unitTitle = unit.title || `Unit ${index + 1}`;

        const unitCard = document.createElement("div");

        unitCard.className = "unit-card";

        unitCard.innerHTML = `
            <div class="unit-content">

                ${
                    unit.image
                        ? `
                    <img
                        src="${escapeHTML(unit.image)}"
                        alt="${escapeHTML(unitTitle)}"
                        class="unit-image"
                        loading="lazy"
                    >
                    `
                        : ""
                }

                <div class="unit-info">

                    <h3>
                        ${escapeHTML(unitTitle)}
                    </h3>

                    ${
                        unit.notes
                            ? `
                        <p>
                            ${escapeHTML(unit.notes)}
                        </p>
                        `
                            : ""
                    }

                    <div class="unit-actions">

                        <button
                            type="button"
                            class="notes-button"
                            data-unit-id="${escapeHTML(unitId)}"
                            data-unit-title="${escapeHTML(unitTitle)}"
                        >
                            📖 Read Notes
                        </button>

                        <button
                            type="button"
                            class="quiz-button"
                            data-unit-id="${escapeHTML(unitId)}"
                            data-unit-title="${escapeHTML(unitTitle)}"
                        >
                            📝 Start Quiz
                        </button>

                    </div>

                </div>
            </div>
        `;

        unitsArea.appendChild(unitCard);
    });

    // =================================================
    // NOTES BUTTONS
    // =================================================

    const notesButtons =
        document.querySelectorAll(".notes-button");

    notesButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const unitId = button.dataset.unitId;
            const unitTitle = button.dataset.unitTitle;

            console.log(
                "📖 Opening notes:",
                unitId,
                unitTitle
            );

            showUnitNotes(unitId, unitTitle);
        });
    });

    // =================================================
    // QUIZ BUTTONS
    // =================================================

    const quizButtons =
        document.querySelectorAll(".quiz-button");

    quizButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const unitId = button.dataset.unitId;
            const unitTitle = button.dataset.unitTitle;

            console.log("📝 Quiz selected");
            console.log("Course ID:", courseId);
            console.log("Unit ID:", unitId);
            console.log("Unit:", unitTitle);

            if (!courseId) {
                console.error(
                    "❌ Cannot open quiz: course ID missing."
                );
                return;
            }

            if (!unitId) {
                console.error(
                    "❌ Cannot open quiz: unit ID missing."
                );
                return;
            }

            // Save selection
            localStorage.setItem(
                "selectedCourse",
                String(courseId)
            );

            localStorage.setItem(
                "selectedCourseName",
                courseName || ""
            );

            localStorage.setItem(
                "selectedUnit",
                String(unitId)
            );

            localStorage.setItem(
                "selectedUnitName",
                unitTitle || ""
            );

            // =============================================
            // BUILD QUIZ URL
            // =============================================

            const params = new URLSearchParams();

            params.set("course", String(courseId));
            params.set("unit_id", String(unitId));

            if (unitTitle) {
                params.set("unit", unitTitle);
            }

            /*
             * IMPORTANT:
             *
             * Do NOT use:
             *
             * /quiz.html
             *
             * because GitHub Pages project sites may use:
             *
             * /repository-name/quiz.html
             *
             * We therefore resolve quiz.html relative
             * to the current course.html location.
             */

            const quizURL =
                new URL(
                    "./quiz.html",
                    window.location.href
                );

            quizURL.search = params.toString();

            console.log(
                "➡️ Opening quiz:",
                quizURL.href
            );

            window.location.assign(
                quizURL.href
            );
        });
    });
}

// =====================================================
// SHOW UNIT NOTES
// =====================================================

async function showUnitNotes(unitId, unitTitle) {
    if (!notesArea) {
        console.error("❌ notesArea was not found.");
        return;
    }

    notesArea.innerHTML = `
        <div class="loading">
            <h3>📖 Loading Notes...</h3>
            <p>${escapeHTML(unitTitle)}</p>
        </div>
    `;

    notesArea.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    const numericUnitId = Number(unitId);

    if (!Number.isInteger(numericUnitId)) {
        console.error(
            "❌ Invalid unit ID:",
            unitId
        );

        notesArea.innerHTML = `
            <div class="error-message">
                <h3>❌ Invalid Unit</h3>
                <p>The selected unit ID is invalid.</p>
            </div>
        `;

        return;
    }

    console.log(
        "📖 Loading notes for unit:",
        numericUnitId
    );

    const { data: unit, error } = await supabase
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
        .eq("id", numericUnitId)
        .maybeSingle();

    if (error) {
        console.error(
            "❌ Unit notes loading error:",
            error
        );

        notesArea.innerHTML = `
            <div class="error-message">
                <h3>❌ Unable to Load Notes</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;

        return;
    }

    if (!unit) {
        console.warn(
            "⚠️ Unit not found:",
            numericUnitId
        );

        notesArea.innerHTML = `
            <div class="empty-message">
                <h3>📖 Notes Not Found</h3>
                <p>No notes are available for this unit.</p>
            </div>
        `;

        return;
    }

    renderDetailedNotes(unit);
}

// =====================================================
// RENDER DETAILED NOTES
// =====================================================

function renderDetailedNotes(unit) {
    if (!notesArea) return;

    let notesHTML = "";

    if (unit.notes_content) {
        notesHTML = unit.notes_content;
    } else if (unit.notes) {
        notesHTML = `
            <p>
                ${escapeHTML(unit.notes)}
            </p>
        `;
    } else {
        notesHTML = `
            <p>
                No detailed notes are available
                for this unit yet.
            </p>
        `;
    }

    notesArea.innerHTML = `
        <div class="unit-notes">

            <div class="notes-header">

                <h2>
                    📖 ${escapeHTML(unit.title)}
                </h2>

                <button
                    type="button"
                    class="close-notes-button"
                    id="closeNotesButton"
                >
                    ✕ Close Notes
                </button>

            </div>

            ${
                unit.video_url
                    ? `
                <div class="unit-video">
                    <video
                        controls
                        preload="metadata"
                    >
                        <source
                            src="${escapeHTML(unit.video_url)}"
                        >
                        Your browser does not support
                        video playback.
                    </video>
                </div>
                `
                    : ""
            }

            <div class="notes-content">
                ${notesHTML}
            </div>

        </div>
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

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        );
    }
}

// =====================================================
// LOAD UPLOADED NOTES
// =====================================================

async function loadUploadedNotes(unitId) {
    if (!notesArea) return;

    const numericUnitId = Number(unitId);

    if (!Number.isInteger(numericUnitId)) {
        return;
    }

    const { data, error } = await supabase
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
        .eq("unit_id", numericUnitId)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        console.error(
            "❌ Uploaded notes error:",
            error
        );

        return;
    }

    if (!data || data.length === 0) {
        return;
    }

    renderUploadedNotes(data);
}

// =====================================================
// RENDER UPLOADED NOTES
// =====================================================

function renderUploadedNotes(notes) {
    if (!notesArea || !notes.length) return;

    const existing =
        notesArea.querySelector(
            ".uploaded-notes"
        );

    if (existing) {
        existing.remove();
    }

    const container =
        document.createElement("div");

    container.className =
        "uploaded-notes";

    container.innerHTML = `
        <h3>📂 Additional Notes</h3>

        <div class="uploaded-notes-list">

            ${notes
                .map(
                    (note) => `
                <div class="uploaded-note">

                    <span>
                        📄
                        ${escapeHTML(
                            note.file_name ||
                            "Notes"
                        )}
                    </span>

                    ${
                        note.file_url
                            ? `
                        <a
                            href="${escapeHTML(
                                note.file_url
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open
                        </a>
                        `
                            : `
                        <span>
                            File unavailable
                        </span>
                        `
                    }

                </div>
            `
                )
                .join("")}

        </div>
    `;

    notesArea.appendChild(container);
}

// =====================================================
// GLOBAL FUNCTION
// =====================================================

window.showUnitNotes = showUnitNotes;

// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        console.log(
            "🚀 Course page initializing..."
        );

        console.log(
            "Course ID:",
            courseId
        );

        console.log(
            "Course Name:",
            courseName
        );

        await loadCourse();

        await loadUnits();

        /*
         * Uploaded notes are loaded when a unit
         * is opened. This prevents unnecessary
         * database requests for every unit.
         */

        console.log(
            "✅ Course page initialized."
        );
    }
);
