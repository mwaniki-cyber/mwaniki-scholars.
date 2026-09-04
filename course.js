import { supabase } from "./supabase.js";

// ============================================================
// MWANIKI SCHOLARS — COURSE PAGE ENGINE
// ============================================================
// Supports:
// 1. courses table
// 2. units table
// 3. units.notes_content
// 4. units.notes
// 5. uploaded notes from public.notes
// 6. quiz.js
// ============================================================


// ============================================================
// GET SELECTED COURSE
// ============================================================

const courseId = localStorage.getItem("selectedCourse");
const courseName = localStorage.getItem("selectedCourseName");

const courseTitle = document.getElementById("courseTitle");
const courseDescription = document.getElementById("courseDescription");
const unitsArea = document.getElementById("unitsArea");
const notesArea = document.getElementById("notesArea");

console.log("📚 Loading selected course:", courseId);


// ============================================================
// BASIC VALIDATION
// ============================================================

if (!courseId) {
    console.error("❌ No selected course found.");

    if (courseTitle) {
        courseTitle.textContent = "Course Not Found";
    }

    if (courseDescription) {
        courseDescription.textContent =
            "Please return to the courses page and select a course.";
    }

    if (unitsArea) {
        unitsArea.innerHTML = `
            <div class="empty-state">
                <h3>⚠️ No Course Selected</h3>
                <p>Please go back and select a course.</p>
            </div>
        `;
    }
}


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

    // Horizontal rule
    text = text.replace(
        /^---$/gm,
        "<hr>"
    );

    // Bullet lists
    text = text.replace(
        /^\s*[-•]\s+(.*)$/gm,
        "<li>$1</li>"
    );

    // Numbered lists
    text = text.replace(
        /^\s*\d+\.\s+(.*)$/gm,
        "<li>$1</li>"
    );

    // Wrap consecutive li elements
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
// GET NOTES DIRECTLY FROM UNIT
// ============================================================

function getUnitNotes(unit) {

    if (!unit) {
        return "";
    }

    // New detailed notes
    if (
        unit.notes_content &&
        String(unit.notes_content).trim() !== ""
    ) {
        return unit.notes_content;
    }

    // Older notes column
    if (
        unit.notes &&
        String(unit.notes).trim() !== ""
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

        const { data, error } = await supabase
            .from("courses")
            .select("*")
            .eq("id", Number(courseId))
            .single();

        if (error) {
            console.error("❌ Course loading error:", error);
            throw error;
        }

        if (!data) {
            throw new Error("Course not found.");
        }

        console.log("✅ Course loaded:", data);

        if (courseTitle) {
            courseTitle.textContent = data.title || courseName || "Course";
        }

        if (courseDescription) {
            courseDescription.textContent =
                data.description || "Medical learning course";
        }

    } catch (error) {

        console.error("❌ Failed to load course:", error);

        if (courseTitle) {
            courseTitle.textContent = "Unable to Load Course";
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
        console.error("❌ unitsArea element not found.");
        return;
    }

    unitsArea.innerHTML = `
        <div class="loading-state">
            ⏳ Loading units...
        </div>
    `;

    try {

        const { data, error } = await supabase
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
            .eq("course_id", Number(courseId))
            .order("id", { ascending: true });

        if (error) {
            console.error("❌ Units loading error:", error);
            throw error;
        }

        console.log("📖 Units loaded:", data);

        if (!data || data.length === 0) {

            unitsArea.innerHTML = `
                <div class="empty-state">
                    <h3>📚 No Units Available</h3>
                    <p>This course does not have any units yet.</p>
                </div>
            `;

            return;
        }

        renderUnits(data);

    } catch (error) {

        console.error("❌ Failed to load units:", error);

        unitsArea.innerHTML = `
            <div class="error-state">
                <h3>❌ Unable to Load Units</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}


// ============================================================
// RENDER UNITS
// ============================================================

function renderUnits(units) {

    unitsArea.innerHTML = "";

    units.forEach((unit, index) => {

        const unitCard = document.createElement("div");

        unitCard.className = "unit-card";

        const hasDirectNotes =
            !!getUnitNotes(unit);

        unitCard.innerHTML = `
            <div class="unit-header">

                <div class="unit-number">
                    Unit ${index + 1}
                </div>

                <h3 class="unit-title">
                    ${escapeHTML(unit.title)}
                </h3>

            </div>

            ${
                unit.image
                    ? `
                    <div class="unit-image">
                        <img
                            src="${escapeHTML(unit.image)}"
                            alt="${escapeHTML(unit.title)}"
                            loading="lazy"
                        >
                    </div>
                    `
                    : ""
            }

            ${
                unit.video_url
                    ? `
                    <div class="unit-video">
                        <video
                            controls
                            preload="metadata"
                            width="100%"
                        >
                            <source
                                src="${escapeHTML(unit.video_url)}"
                            >
                            Your browser does not support video playback.
                        </video>
                    </div>
                    `
                    : ""
            }

            <div class="unit-actions">

                <button
                    type="button"
                    class="quiz-button"
                    data-unit-id="${unit.id}"
                    data-unit-title="${escapeHTML(unit.title)}"
                >
                    📝 Start Quiz
                </button>

                <button
                    type="button"
                    class="notes-button"
                    data-unit-id="${unit.id}"
                    data-unit-title="${escapeHTML(unit.title)}"
                >
                    📄 View Notes
                </button>

            </div>

            ${
                hasDirectNotes
                    ? `
                    <div class="notes-status">
                        ✅ Detailed notes available
                    </div>
                    `
                    : `
                    <div class="notes-status">
                        📚 Course notes available
                    </div>
                    `
            }
        `;

        unitsArea.appendChild(unitCard);
    });


   
// ========================================================
// QUIZ BUTTONS
// ========================================================

document
    .querySelectorAll(".quiz-button")
    .forEach(button => {

        button.addEventListener(
            "click",
            function () {

                const unitId =
                    this.dataset.unitId;

                const unitTitle =
                    this.dataset.unitTitle;

                console.log(
                    "📝 Opening Supabase quiz:",
                    {
                        courseId: courseId,
                        unitId: unitId,
                        unitTitle: unitTitle
                    }
                );


                // --------------------------------------------
                // SAVE CURRENT SELECTION
                // --------------------------------------------

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


                // --------------------------------------------
                // OPEN QUIZ PAGE
                // --------------------------------------------

                const quizURL =
                    `quiz.html?course=${encodeURIComponent(courseId)}` +
                    `&unit_id=${encodeURIComponent(unitId)}` +
                    `&unit=${encodeURIComponent(unitTitle)}`;


                console.log(
                    "➡️ Quiz URL:",
                    quizURL
                );


                window.location.href =
                    quizURL;

            }
        );

    });
    
    // ========================================================
    // NOTES BUTTONS
    // ========================================================

    document
        .querySelectorAll(".notes-button")
        .forEach(button => {

            button.addEventListener("click", async function () {

                const unitId = this.dataset.unitId;
                const unitTitle = this.dataset.unitTitle;

                console.log(
                    "📄 Showing notes for:",
                    unitTitle,
                    unitId
                );

                await showUnitNotes(
                    Number(unitId),
                    unitTitle
                );
            });
        });


    console.log(
        `✅ ${units.length} units displayed`
    );
}


// ============================================================
// SHOW UNIT NOTES
// ============================================================

async function showUnitNotes(unitId, unitTitle) {

    if (!notesArea) {

        console.error(
            "❌ notesArea element not found in course.html"
        );

        return;
    }

    notesArea.innerHTML = `
        <div class="loading-state">
            ⏳ Loading notes for
            <strong>${escapeHTML(unitTitle)}</strong>...
        </div>
    `;

    notesArea.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });


    try {

        console.log(
            "🔎 Loading unit:",
            unitId
        );


        // ====================================================
        // STEP 1 — CHECK UNIT DIRECT NOTES
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
            .eq("id", Number(unitId))
            .single();


        if (unitError) {

            console.error(
                "❌ UNIT ERROR:",
                unitError
            );
        }


        if (unit) {

            console.log(
                "📖 Unit found:",
                unit
            );

            const directNotes =
                getUnitNotes(unit);

            if (
                directNotes &&
                String(directNotes).trim() !== ""
            ) {

                console.log(
                    "✅ Direct unit notes found"
                );

                renderDetailedNotes(
                    unit.title || unitTitle,
                    directNotes
                );

                return;
            }
        }


        // ====================================================
        // STEP 2 — SEARCH public.notes BY IDs
        // ====================================================

        console.log(
            "🔎 Searching uploaded notes:",
            {
                course_id: Number(courseId),
                unit_id: Number(unitId)
            }
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
            .eq("course_id", Number(courseId))
            .eq("unit_id", Number(unitId))
            .order("created_at", {
                ascending: false
            });


        if (notesError) {

            console.error(
                "❌ UPLOADED NOTES ERROR:",
                notesError
            );

            throw notesError;
        }


        console.log(
            "📦 Uploaded notes found:",
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
        // STEP 3 — FALLBACK USING TEXT VALUES
        // ====================================================

        console.log(
            "🔎 No ID match. Trying text fallback..."
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
            .eq("course_id", Number(courseId))
            .eq("unit", unitTitle)
            .order("created_at", {
                ascending: false
            });


        if (fallbackError) {

            console.error(
                "❌ FALLBACK NOTES ERROR:",
                fallbackError
            );
        }


        console.log(
            "📦 Fallback notes:",
            fallbackNotes
        );


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
        // STEP 4 — SEARCH BY COURSE + UNIT NAME
        // ====================================================

        console.log(
            "🔎 Final notes search..."
        );


        const {
            data: finalNotes,
            error: finalError
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
            .eq("unit", unitTitle)
            .order("created_at", {
                ascending: false
            });


        if (finalError) {

            console.error(
                "❌ FINAL NOTES ERROR:",
                finalError
            );
        }


        if (
            finalNotes &&
            finalNotes.length > 0
        ) {

            // Only show notes belonging to current course
            const matchingNotes =
                finalNotes.filter(note => {

                    if (
                        note.course_id === null ||
                        note.course_id === undefined
                    ) {
                        return true;
                    }

                    return (
                        Number(note.course_id) ===
                        Number(courseId)
                    );
                });


            if (matchingNotes.length > 0) {

                renderUploadedNotes(
                    unitTitle,
                    matchingNotes
                );

                return;
            }
        }


        // ====================================================
        // NOTHING FOUND
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
                    There are currently no notes uploaded
                    for <strong>${escapeHTML(unitTitle)}</strong>.
                </p>

                <p class="notes-help">
                    Notes uploaded by the administrator
                    will appear here automatically.
                </p>

            </div>
        `;


    } catch (error) {

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
                    ${escapeHTML(error.message)}
                </p>

                <button
                    type="button"
                    onclick="location.reload()"
                >
                    🔄 Try Again
                </button>

            </div>
        `;
    }
}


// ============================================================
// RENDER DETAILED NOTES
// ============================================================

function renderDetailedNotes(
    unitTitle,
    notesContent
) {

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

    console.log(
        "📚 Rendering uploaded notes:",
        uploadedNotes
    );


    let cards = "";


    uploadedNotes.forEach(note => {

        if (!note.file_url) {
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
                        ${escapeHTML(fileExtension)}
                        ${createdDate
                            ? ` • Uploaded ${escapeHTML(createdDate)}`
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
    });


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
// GLOBAL ACCESS
// ============================================================

window.showUnitNotes = showUnitNotes;


// ============================================================
// INITIALIZE
// ============================================================

async function initializeCoursePage() {

    console.log(
        "🚀 Initializing Mwaniki Scholars course page..."
    );

    console.log(
        "📚 Course ID:",
        courseId
    );

    console.log(
        "📚 Course Name:",
        courseName
    );


    if (!courseId) {
        return;
    }


    await loadCourse();

    await loadUnits();


    console.log(
        "✅ Mwaniki Scholars Course Engine Loaded"
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

} else {

    initializeCoursePage();
}
