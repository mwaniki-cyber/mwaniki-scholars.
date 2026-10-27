
import { supabase } from "./supabase.js";

// ============================================================
// MWANIKI SCHOLARS — COURSE PAGE ENGINE
// Handles course details, units, quizzes and study notes.
// ============================================================

console.log("📚 Mwaniki Scholars Course Engine Loaded");

const $ = id => document.getElementById(id);

const courseTitle = $("courseTitle");
const courseDescription = $("courseDescription");
const unitsArea = $("unitsArea");
const notesArea = $("notesArea");
const communityButton = $("courseCommunityButton");
const communityStatus = $("courseCommunityStatus");

const params = new URLSearchParams(window.location.search);

const courseId =
    params.get("course_id") ||
    localStorage.getItem("selectedCourse");

const courseName = localStorage.getItem("selectedCourseName");

if (courseId) {
    localStorage.setItem("selectedCourse", String(courseId));
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatNotes(content) {
    if (!content) return "<p>No detailed notes are available for this unit yet.</p>";

    // Escape HTML before adding basic formatting.
    let html = escapeHTML(content);

    html = html.replace(/^### (.+)$/gm, "<h4>$1</h4>");
    html = html.replace(/^## (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^# (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    html = html.replace(/^---$/gm, "<hr>");
    html = html.replace(/^\s*[-•]\s+(.+)$/gm, "<li>$1</li>");
    html = html.replace(/^\s*\d+\.\s+(.+)$/gm, "<li>$1</li>");
    html = html.replace(/((?:<li>.*?<\/li>\s*)+)/gs, "<ul>$1</ul>");
    html = html.replace(/\n{2,}/g, "<br><br>");
    html = html.replace(/\n/g, "<br>");

    return html;
}

function showMessage(container, message) {
    if (container) {
        container.innerHTML = `<div class="empty-state">${escapeHTML(message)}</div>`;
    }
}

async function loadCourse() {
    if (!courseId) {
        if (courseTitle) courseTitle.textContent = "Course Not Selected";
        if (courseDescription) {
            courseDescription.textContent =
                "Return to your dashboard and select a course.";
        }
        showMessage(unitsArea, "Please select a course first.");
        return false;
    }

    const { data, error } = await supabase
        .from("courses")
        .select("id, title, description")
        .eq("id", Number(courseId))
        .single();

    if (error) {
        console.error("❌ Course loading error:", error);
        if (courseTitle) courseTitle.textContent = "Unable to Load Course";
        if (courseDescription) {
            courseDescription.textContent =
                "The course could not be loaded. Please refresh and try again.";
        }
        showMessage(unitsArea, error.message || "Could not load course details.");
        return false;
    }

    if (courseTitle) {
        courseTitle.textContent = data.title || courseName || "Course";
    }

    if (courseDescription) {
        courseDescription.textContent =
            data.description || "Medical learning course";
    }

    localStorage.setItem("selectedCourse", String(data.id));
    localStorage.setItem("selectedCourseName", data.title || "");

    return true;
}

function openCourseCommunity() {
    if (!courseId) return;

    const selectedName =
        localStorage.getItem("selectedCourseName") || courseName || "";

    const query = new URLSearchParams({
        course_id: String(courseId),
        source: "course"
    });

    if (selectedName) query.set("course_name", selectedName);

    window.location.href = `./community.html?${query.toString()}`;
}

function setupCourseCommunity() {
    if (!communityButton) return;

    communityButton.addEventListener("click", openCourseCommunity);

    if (!courseId) {
        communityButton.disabled = true;
        if (communityStatus) {
            communityStatus.textContent = "Select a course to open its community.";
        }
        return;
    }

    communityButton.disabled = false;

    if (communityStatus) {
        communityStatus.textContent =
            "Open the discussion space for this course.";
    }
}

function renderUnits(units) {
    if (!unitsArea) return;

    if (!units.length) {
        showMessage(unitsArea, "No units have been added to this course yet.");
        return;
    }

    unitsArea.innerHTML = "";

    units.forEach((unit, index) => {
        const card = document.createElement("article");
        card.className = "unit-card";

        const title = document.createElement("h3");
        title.textContent = `Unit ${index + 1}: ${unit.title || "Untitled Unit"}`;
        card.appendChild(title);

        if (unit.image && /^https?:\/\//i.test(unit.image)) {
            const image = document.createElement("img");
            image.src = unit.image;
            image.alt = unit.title || "Course unit";
            image.loading = "lazy";
            image.className = "unit-image";
            card.appendChild(image);
        }

        if (unit.video_url && /^https?:\/\//i.test(unit.video_url)) {
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
        notesButton.textContent = "📄 View Notes";
        notesButton.addEventListener("click", () => showUnitNotes(unit));

        const quizButton = document.createElement("button");
        quizButton.type = "button";
        quizButton.textContent = "📝 Start Quiz";
        quizButton.addEventListener("click", () => {
            localStorage.setItem("selectedCourse", String(courseId));
            localStorage.setItem("selectedCourseName", courseTitle?.textContent || "");
            localStorage.setItem("selectedUnit", String(unit.id));
            localStorage.setItem("selectedUnitTitle", unit.title || "");

            const query = new URLSearchParams({
                course: String(courseId),
                unit_id: String(unit.id),
                unit: unit.title || ""
            });

            window.location.href = `./quiz.html?${query.toString()}`;
        });

        actions.append(notesButton, quizButton);
        card.appendChild(actions);
        unitsArea.appendChild(card);
    });
}

async function loadUnits() {
    if (!courseId || !unitsArea) return;

    unitsArea.textContent = "Loading course units…";

    const { data, error } = await supabase
        .from("units")
        .select("id, course_id, title, notes, notes_content, image, video_url, created_at")
        .eq("course_id", Number(courseId))
        .order("id", { ascending: true });

    if (error) {
        console.error("❌ Units loading error:", error);
        showMessage(unitsArea, error.message || "Could not load course units.");
        return;
    }

    renderUnits(data || []);
}

async function showUnitNotes(unit) {
    if (!notesArea || !unit) return;

    localStorage.setItem("selectedUnit", String(unit.id));
    localStorage.setItem("selectedUnitTitle", unit.title || "");

    notesArea.innerHTML = "";

    const section = document.createElement("section");
    section.className = "course-notes";

    const heading = document.createElement("h2");
    heading.textContent = `📖 ${unit.title || "Unit Notes"}`;
    section.appendChild(heading);

    const content = unit.notes_content || unit.notes || "";

    if (String(content).trim()) {
        const article = document.createElement("article");
        article.className = "detailed-notes";
        article.innerHTML = formatNotes(String(content));
        section.appendChild(article);
    } else {
        const message = document.createElement("p");
        message.textContent = "No written notes are saved in this unit yet.";
        section.appendChild(message);
    }

    notesArea.appendChild(section);
    notesArea.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Preserve access for any existing HTML buttons that call this function.
window.showUnitNotes = async function (unitId, unitTitle) {
    const { data, error } = await supabase
        .from("units")
        .select("id, title, notes, notes_content")
        .eq("id", Number(unitId))
        .single();

    if (error) {
        console.error("❌ Unable to load unit notes:", error);
        showMessage(notesArea, "Unable to load notes for this unit.");
        return;
    }

    await showUnitNotes({
        ...data,
        title: unitTitle || data.title
    });
};

async function initializeCoursePage() {
    console.log("🚀 Initializing Mwaniki Scholars Course Page…");

    setupCourseCommunity();

    try {
        const loaded = await loadCourse();
        if (loaded) await loadUnits();
    } catch (error) {
        console.error("❌ Course page initialization failed:", error);
        showMessage(unitsArea, "The course page could not be initialized. Check the browser console.");
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeCoursePage);
} else {
    initializeCoursePage();
}
