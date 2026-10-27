
import { supabase } from "./supabase.js";

/* ============================================================
   MWANIKI SCHOLARS — COURSE PAGE
   - Loads selected course and units
   - Shows uploaded Notes Library files FIRST
   - Uses written unit notes only as a fallback
   - Preserves quiz and course community navigation
============================================================ */

console.log("📚 Mwaniki Scholars Course Engine Loaded");

const $ = id => document.getElementById(id);

const courseTitleElement = $("courseTitle");
const courseDescriptionElement = $("courseDescription");
const unitsArea = $("unitsArea");
const notesArea = $("notesArea");
const communityButton = $("courseCommunityButton");
const communityStatus = $("courseCommunityStatus");

const urlParams = new URLSearchParams(window.location.search);

const courseId =
    urlParams.get("course_id") ||
    localStorage.getItem("selectedCourse");

let currentCourseName =
    localStorage.getItem("selectedCourseName") || "";

if (courseId) {
    localStorage.setItem("selectedCourse", String(courseId));
}

/* ============================================================
   HELPERS
============================================================ */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function isValidURL(value) {
    if (!value) return false;

    try {
        const url = new URL(String(value).trim());
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

function showMessage(container, message) {
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state">
            ${escapeHTML(message)}
        </div>
    `;
}

function getUnitNotes(unit) {
    if (!unit) return "";

    if (
        unit.notes_content &&
        String(unit.notes_content).trim()
    ) {
        return String(unit.notes_content);
    }

    if (
        unit.notes &&
        String(unit.notes).trim()
    ) {
        return String(unit.notes);
    }

    return "";
}

/* ============================================================
   FORMAT WRITTEN NOTES
============================================================ */

function formatDetailedNotes(content) {
    if (!content) return "";

    let text = escapeHTML(content);

    text = text.replace(/^### (.+)$/gm, "<h4>$1</h4>");
    text = text.replace(/^## (.+)$/gm, "<h3>$1</h3>");
    text = text.replace(/^# (.+)$/gm, "<h2>$1</h2>");

    text = text.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    text = text.replace(
        /\*(.*?)\*/g,
        "<em>$1</em>"
    );

    text = text.replace(/^---$/gm, "<hr>");

    text = text.replace(
        /^\s*[-•]\s+(.+)$/gm,
        "<li>$1</li>"
    );

    text = text.replace(
        /^\s*\d+\.\s+(.+)$/gm,
        "<li>$1</li>"
    );

    text = text.replace(
        /((?:<li>.*?<\/li>\s*)+)/gs,
        "<ul>$1</ul>"
    );

    text = text.replace(/\n{2,}/g, "<br><br>");
    text = text.replace(/\n/g, "<br>");

    return text;
}

/* ============================================================
   COURSE COMMUNITY
============================================================ */

function getCourseCommunityURL() {
    if (!courseId) return "./community.html";

    const params = new URLSearchParams();

    params.set("course_id", String(courseId));
    params.set("source", "course");

    const name =
        currentCourseName ||
        courseTitleElement?.textContent ||
        "";

    if (name && name !== "Loading Course...") {
        params.set("course_name", name);
    }

    return `./community.html?${params.toString()}`;
}

function openCourseCommunity() {
    if (!courseId) return;

    localStorage.setItem("selectedCourse", String(courseId));
    localStorage.setItem("selectedCourseName", currentCourseName);

    window.location.href = getCourseCommunityURL();
}

function setupCourseCommunity() {
    if (!communityButton) return;

    if (!courseId) {
        communityButton.disabled = true;

        if (communityStatus) {
            communityStatus.textContent =
                "Select a course to open its community.";
        }

        return;
    }

    communityButton.disabled = false;

    communityButton.addEventListener(
        "click",
        openCourseCommunity
    );

    if (communityStatus) {
        communityStatus.textContent =
            "Open the discussion space for this course.";
    }
}

/* ============================================================
   LOAD COURSE DETAILS
============================================================ */

async function loadCourse() {
    if (!courseId) {
        throw new Error("No course has been selected.");
    }

    const { data, error } = await supabase
        .from("courses")
        .select("id, title, description")
        .eq("id", Number(courseId))
        .single();

    if (error) throw error;

    if (!data) {
        throw new Error("The selected course could not be found.");
    }

    currentCourseName = data.title || currentCourseName || "Course";

    localStorage.setItem("selectedCourse", String(data.id));
    localStorage.setItem("selectedCourseName", currentCourseName);

    if (courseTitleElement) {
        courseTitleElement.textContent = currentCourseName;
    }

    if (courseDescriptionElement) {
        courseDescriptionElement.textContent =
            data.description || "Medical learning course";
    }

    console.log("✅ Course loaded:", data);
}

/* ============================================================
   LOAD COURSE UNITS
============================================================ */

async function loadUnits() {
    if (!unitsArea) {
        console.error("❌ #unitsArea was not found.");
        return;
    }

    unitsArea.innerHTML = `
        <div class="loading">⏳ Loading course units...</div>
    `;

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
        console.error("❌ Units loading failed:", error);
        showMessage(
            unitsArea,
            error.message || "Unable to load course units."
        );
        return;
    }

    if (!data || data.length === 0) {
        showMessage(
            unitsArea,
            "No units have been added to this course yet."
        );
        return;
    }

    renderUnits(data);
}

/* ============================================================
   RENDER UNIT CARDS
============================================================ */

function renderUnits(units) {
    if (!unitsArea) return;

    unitsArea.innerHTML = "";

    units.forEach((unit, index) => {
        const card = document.createElement("article");
        card.className = "unit-card";

        const heading = document.createElement("h3");
        heading.className = "unit-title";
        heading.textContent =
            `Unit ${index + 1}: ${unit.title || "Untitled Unit"}`;

        card.appendChild(heading);

        if (isValidURL(unit.image)) {
            const image = document.createElement("img");

            image.src = unit.image;
            image.alt = unit.title || "Course unit";
            image.loading = "lazy";
            image.className = "unit-image";

            image.addEventListener("error", () => image.remove());

            card.appendChild(image);
        }

        if (isValidURL(unit.video_url)) {
            const videoLink = document.createElement("a");

            videoLink.href = unit.video_url;
            videoLink.target = "_blank";
            videoLink.rel = "noopener noreferrer";
            videoLink.textContent = "▶ Open Unit Video";

            card.appendChild(videoLink);
        }

        const actions = document.createElement("div");
        actions.className = "unit-actions";

        const notesButton = document.createElement("button");
        notesButton.type = "button";
        notesButton.className = "notes-button";
        notesButton.textContent = "📄 View Notes";

        notesButton.addEventListener("click", () => {
            localStorage.setItem("selectedCourse", String(courseId));
            localStorage.setItem(
                "selectedCourseName",
                currentCourseName
            );

            localStorage.setItem("selectedUnit", String(unit.id));
            localStorage.setItem(
                "selectedUnitTitle",
                unit.title || ""
            );

            showUnitNotes(unit.id, unit.title || "Unit Notes");
        });

        const quizButton = document.createElement("button");
        quizButton.type = "button";
        quizButton.className = "quiz-button";
        quizButton.textContent = "📝 Start Quiz";

        quizButton.addEventListener("click", () => {
            localStorage.setItem("selectedCourse", String(courseId));
            localStorage.setItem(
                "selectedCourseName",
                currentCourseName
            );
            localStorage.setItem("selectedUnit", String(unit.id));
            localStorage.setItem(
                "selectedUnitTitle",
                unit.title || ""
            );

            const query = new URLSearchParams({
                course: String(courseId),
                unit_id: String(unit.id),
                unit: unit.title || ""
            });

            window.location.href = `./quiz.html?${query.toString()}`;
        });

        actions.append(notesButton, quizButton);
        card.appendChild(actions);

        const status = document.createElement("p");
        status.className = "notes-status";
        status.textContent =
            "📚 Check the Notes Library for this unit's study materials.";

        card.appendChild(status);
        unitsArea.appendChild(card);
    });

    console.log(`✅ ${units.length} course units displayed.`);
}

/* ============================================================
   LOAD NOTES FOR A SELECTED UNIT
   IMPORTANT: THE NOTES LIBRARY IS CHECKED FIRST.
============================================================ */

async function showUnitNotes(unitId, unitTitle) {
    if (!notesArea) {
        console.error("❌ #notesArea was not found.");
        return;
    }

    const selectedCourseId = Number(courseId);
    const selectedUnitId = Number(unitId);

    if (!selectedCourseId || !selectedUnitId) {
        showMessage(
            notesArea,
            "Please select a course and unit first."
        );
        return;
    }

    localStorage.setItem(
        "selectedCourse",
        String(selectedCourseId)
    );
    localStorage.setItem(
        "selectedUnit",
        String(selectedUnitId)
    );
    localStorage.setItem(
        "selectedUnitTitle",
        unitTitle || ""
    );

    notesArea.innerHTML = `
        <section class="course-notes">
            <h2>📚 Loading Study Materials</h2>
            <p>
                Searching the Notes Library for
                ${escapeHTML(unitTitle)}...
            </p>
        </section>
    `;

    notesArea.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    try {
        /*
         * FIRST: Exact match using course_id and unit_id.
         * The published filter ensures students see only
         * published library files.
         */
        const { data: linkedNotes, error: linkedError } =
            await supabase
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
                .eq("published", true)
                .eq("course_id", selectedCourseId)
                .eq("unit_id", selectedUnitId)
                .order("created_at", { ascending: false });

        if (linkedError) {
            console.error(
                "❌ Notes Library ID search failed:",
                linkedError
            );
        }

        const linkedFiles = (linkedNotes || []).filter(
            note => isValidURL(note.file_url)
        );

        if (linkedFiles.length > 0) {
            console.log(
                "✅ Notes Library files found by IDs:",
                linkedFiles.length
            );

            renderUploadedNotes(unitTitle, linkedFiles);
            return;
        }

        /*
         * SECOND: Match the course and unit title.
         * This helps when an uploaded file has a unit title
         * but its unit_id was not assigned.
         */
        const { data: titleMatches, error: titleError } =
            await supabase
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
                .eq("published", true)
                .eq("course_id", selectedCourseId)
                .ilike("unit", unitTitle)
                .order("created_at", { ascending: false });

        if (titleError) {
            console.warn(
                "⚠️ Notes Library title search failed:",
                titleError
            );
        }

        const titleFiles = (titleMatches || []).filter(
            note => isValidURL(note.file_url)
        );

        if (titleFiles.length > 0) {
            console.log(
                "✅ Notes Library files found by unit title:",
                titleFiles.length
            );

            renderUploadedNotes(unitTitle, titleFiles);
            return;
        }

        /*
         * THIRD: Only use the units table if the Notes
         * Library contains no matching published files.
         */
        const { data: unit, error: unitError } = await supabase
            .from("units")
            .select(`
                id,
                course_id,
                title,
                notes,
                notes_content
            `)
            .eq("id", selectedUnitId)
            .eq("course_id", selectedCourseId)
            .single();

        if (unitError) {
            throw unitError;
        }

        const writtenNotes = getUnitNotes(unit);

        if (writtenNotes.trim()) {
            renderDetailedNotes(
                unit.title || unitTitle,
                writtenNotes
            );
            return;
        }

        notesArea.innerHTML = `
            <section class="empty-notes">
                <h2>📚 No Notes Found</h2>
                <p>
                    No published uploaded files or written notes
                    were found for
                    <strong>${escapeHTML(unitTitle)}</strong>.
                </p>
                <p>
                    Check that the note is published and assigned
                    to the correct course and unit in the Notes Library.
                </p>
            </section>
        `;

    } catch (error) {
        console.error("❌ Failed to load unit notes:", error);

        notesArea.innerHTML = `
            <section class="error-notes">
                <h2>Unable to Load Notes</h2>
                <p>${escapeHTML(
                    error.message || "An unexpected error occurred."
                )}</p>
                <button type="button" id="retryNotesButton">
                    🔄 Try Again
                </button>
            </section>
        `;

        $("retryNotesButton")?.addEventListener("click", () => {
            showUnitNotes(unitId, unitTitle);
        });
    }
}

/* ============================================================
   RENDER UPLOADED NOTES LIBRARY FILES
============================================================ */

function renderUploadedNotes(unitTitle, uploadedNotes) {
    if (!notesArea) return;

    const validNotes = (uploadedNotes || []).filter(
        note => isValidURL(note.file_url)
    );

    if (!validNotes.length) {
        showMessage(
            notesArea,
            "No accessible uploaded note files were found."
        );
        return;
    }

    const cards = validNotes.map(note => {
        const fileName = note.file_name || "Course Notes";
        const safeURL = String(note.file_url).trim();

        const extension = fileName.includes(".")
            ? fileName.split(".").pop().toUpperCase()
            : "STUDY MATERIAL";

        const uploadedDate = note.created_at
            ? new Date(note.created_at).toLocaleDateString()
            : "";

        return `
            <article class="uploaded-note-card">
                <div class="uploaded-note-icon">📄</div>

                <div class="uploaded-note-info">
                    <h3>${escapeHTML(fileName)}</h3>

                    <p>
                        ${escapeHTML(extension)}
                        ${uploadedDate
                            ? ` · Uploaded ${escapeHTML(uploadedDate)}`
                            : ""}
                    </p>
                </div>

                <div class="uploaded-note-action">
                    <a
                        class="open-notes-link"
                        href="${escapeHTML(safeURL)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        📖 Open Notes
                    </a>
                </div>
            </article>
        `;
    }).join("");

    notesArea.innerHTML = `
        <section class="course-notes">
            <div class="notes-header">
                <span class="notes-icon">📚</span>

                <div>
                    <h2>${escapeHTML(unitTitle)}</h2>
                    <p>Uploaded Course Notes & Study Materials</p>
                </div>
            </div>

            <div class="uploaded-notes-list">
                ${cards}
            </div>
        </section>
    `;
}

/* ============================================================
   RENDER WRITTEN UNIT NOTES — FALLBACK ONLY
============================================================ */

function renderDetailedNotes(unitTitle, notesContent) {
    if (!notesArea) return;

    notesArea.innerHTML = `
        <section class="course-notes">
            <div class="notes-header">
                <span class="notes-icon">📖</span>

                <div>
                    <h2>${escapeHTML(unitTitle)}</h2>
                    <p>Written Unit Notes</p>
                </div>
            </div>

            <article class="notes-content">
                ${formatDetailedNotes(notesContent)}
            </article>
        </section>
    `;
}

/* ============================================================
   SUPPORT EXISTING HTML BUTTONS
============================================================ */

window.showUnitNotes = showUnitNotes;

/* ============================================================
   INITIALIZE COURSE PAGE
============================================================ */

async function initializeCoursePage() {
    console.log("🚀 Initializing Mwaniki Scholars Course Page...");

    setupCourseCommunity();

    if (!courseId || !Number.isFinite(Number(courseId))) {
        if (courseTitleElement) {
            courseTitleElement.textContent = "Course Not Selected";
        }

        if (courseDescriptionElement) {
            courseDescriptionElement.textContent =
                "Return to your dashboard and select a course.";
        }

        showMessage(
            unitsArea,
            "Please select a course from your dashboard first."
        );

        return;
    }

    if (courseTitleElement) {
        courseTitleElement.textContent = "Loading Course...";
    }

    try {
        await loadCourse();
        await loadUnits();

        console.log("✅ Course page fully initialized.");
    } catch (error) {
        console.error(
            "❌ Course page initialization failed:",
            error
        );

        if (courseTitleElement) {
            courseTitleElement.textContent = "Unable to Load Course";
        }

        if (courseDescriptionElement) {
            courseDescriptionElement.textContent =
                "Please refresh the page and try again.";
        }

        showMessage(
            unitsArea,
            error.message || "Unable to initialize this course."
        );
    }
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeCoursePage
    );
} else {
    initializeCoursePage();
}
