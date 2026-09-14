import { supabase } from "./supabase.js";

/*
=========================================================
MWANIKI SCHOLARS
STUDENT DASHBOARD ENGINE
=========================================================
*/

console.log("🚀 Mwaniki Scholars dashboard engine loaded");

/* ======================================================
   STATE
====================================================== */

let currentUser = null;
let currentStudent = null;

let allCourses = [];
let allNotes = [];
let allQuizzes = [];

/* ======================================================
   HELPERS
====================================================== */

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showMessage(message, type = "info") {
    let box = $("dashboardMessage");

    if (!box) {
        box = document.createElement("div");
        box.id = "dashboardMessage";

        Object.assign(box.style, {
            position: "fixed",
            right: "20px",
            bottom: "20px",
            zIndex: "99999",
            maxWidth: "420px",
            padding: "14px 18px",
            borderRadius: "12px",
            background: type === "error" ? "#b42318" : "#062b49",
            color: "#ffffff",
            fontSize: "14px",
            lineHeight: "1.5",
            boxShadow: "0 10px 30px rgba(0,0,0,.2)"
        });

        document.body.appendChild(box);
    }

    box.textContent = message;

    clearTimeout(showMessage.timer);

    showMessage.timer = setTimeout(() => {
        box.remove();
    }, 4500);
}

function getStudentName() {
    return (
        currentStudent?.full_name ||
        currentUser?.user_metadata?.full_name ||
        currentUser?.user_metadata?.name ||
        currentUser?.email ||
        "Student"
    );
}

function getStudentEmail() {
    return (
        currentStudent?.email ||
        currentUser?.email ||
        ""
    );
}

/* ======================================================
   PROFILE
====================================================== */

function updateStudentIdentity() {
    const name = getStudentName();
    const email = getStudentEmail();

    const profileName = $("dashboardProfileName");
    const welcomeName = $("welcomeName");
    const studentNameInput = $("studentName");
    const studentEmailInput = $("studentEmail");

    if (profileName) {
        profileName.textContent = name;
    }

    if (welcomeName) {
        welcomeName.textContent = name;
    }

    if (studentNameInput) {
        studentNameInput.value = name;
    }

    if (studentEmailInput) {
        studentEmailInput.value = email;
    }

    const checkEmail = $("checkEmail");

    if (checkEmail && !checkEmail.value) {
        checkEmail.value = email;
    }
}

function renderProfileImage(
    imageElement,
    fallbackElement,
    photoURL,
    studentName
) {
    if (!imageElement) {
        return;
    }

    if (!photoURL) {
        imageElement.style.display = "none";

        if (fallbackElement) {
            fallbackElement.style.display = "flex";
            fallbackElement.textContent = getInitials(studentName);
        }

        return;
    }

    imageElement.src = photoURL;
    imageElement.alt = `${studentName} profile photo`;
    imageElement.style.display = "block";

    if (fallbackElement) {
        fallbackElement.style.display = "none";
    }

    imageElement.onerror = () => {
        imageElement.style.display = "none";

        if (fallbackElement) {
            fallbackElement.style.display = "flex";
            fallbackElement.textContent = getInitials(studentName);
        }
    };
}

function getInitials(name) {
    const cleanName = String(name || "Student")
        .trim()
        .replace(/\s+/g, " ");

    if (!cleanName) {
        return "S";
    }

    const parts = cleanName.split(" ");

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
    ).toUpperCase();
}

function updateStudentPhoto() {
    const name = getStudentName();
    const photoURL = currentStudent?.photo_url || "";

    renderProfileImage(
        $("dashboardProfilePhoto"),
        null,
        photoURL,
        name
    );

    renderProfileImage(
        $("dashboardHeroProfilePhoto"),
        $("dashboardHeroFallback"),
        photoURL,
        name
    );
}

async function loadStudentProfile() {
    try {
        const {
            data: authData,
            error: authError
        } = await supabase.auth.getUser();

        if (authError) {
            console.error("Authentication error:", authError);
        }

        currentUser = authData?.user || null;

        if (!currentUser) {
            window.location.href = "./index.html";
            return false;
        }

        const {
            data,
            error
        } = await supabase
            .from("students")
            .select(`
                id,
                full_name,
                email,
                phone,
                course,
                level,
                photo_url,
                created_at
            `)
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) {
            console.warn("Student profile could not be loaded:", error);
            currentStudent = null;
        } else {
            currentStudent = data || null;
        }

        updateStudentIdentity();
        updateStudentPhoto();

        return true;
    } catch (error) {
        console.error("Profile loading failed:", error);
        return false;
    }
}

/* ======================================================
   DATE
====================================================== */

function updateCurrentDate() {
    const element = $("currentDate");

    if (!element) {
        return;
    }

    element.textContent = new Date().toLocaleDateString(
        "en-KE",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );
}

/* ======================================================
   COURSES
====================================================== */

function getCourseURL(course) {
    if (!course || course.id === undefined || course.id === null) {
        return "./course.html";
    }

    return `./course.html?course_id=${encodeURIComponent(course.id)}`;
}

function openCourse(course) {
    if (!course) {
        return;
    }

    localStorage.setItem(
        "selectedCourse",
        String(course.id)
    );

    localStorage.setItem(
        "selectedCourseName",
        course.title || ""
    );

    localStorage.setItem(
        "mwanikiLastCourse",
        JSON.stringify({
            id: course.id,
            title: course.title || "",
            description: course.description || "",
            image: course.image || ""
        })
    );

    window.location.href = getCourseURL(course);
}

function createCourseCard(course) {
    const title = course.title || "Untitled Course";
    const description =
        course.description ||
        "Explore units, notes and quizzes for this course.";

    const image = course.image || "";

    const visual = image
        ? `
            <div class="course-card-visual">
                <img
                    class="course-card-image"
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(title)}"
                    loading="lazy"
                >
            </div>
        `
        : `
            <div class="course-card-visual">
                <div
                    class="course-card-placeholder"
                    aria-hidden="true"
                >
                    📚
                </div>
            </div>
        `;

    return `
        <article class="course-card">
            ${visual}

            <div class="course-card-body">
                <h3>${escapeHTML(title)}</h3>

                <p>${escapeHTML(description)}</p>

                <button
                    type="button"
                    class="course-card-button"
                    data-course-id="${escapeHTML(course.id)}"
                >
                    View Course
                </button>
            </div>
        </article>
    `;
}

function renderCourses(courses = allCourses) {
    const area = $("courseArea");

    if (!area) {
        return;
    }

    if (!courses.length) {
        area.innerHTML = `
            <div class="empty-state">
                <strong>No courses found.</strong>
                <span>Available courses will appear here.</span>
            </div>
        `;

        return;
    }

    area.innerHTML = `
        <div class="course-grid">
            ${courses.map(createCourseCard).join("")}
        </div>
    `;

    area.querySelectorAll("[data-course-id]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                const courseID = Number(button.dataset.courseId);

                const course = allCourses.find(
                    (item) => Number(item.id) === courseID
                );

                if (course) {
                    openCourse(course);
                }
            });
        });
}

async function loadCourses() {
    const area = $("courseArea");

    if (area) {
        area.innerHTML = `
            <div class="loading-state">
                Loading courses...
            </div>
        `;
    }

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
            .order("id", {
                ascending: true
            });

        if (error) {
            throw error;
        }

        allCourses = Array.isArray(data) ? data : [];

        const totalCourses = $("totalCourses");

        if (totalCourses) {
            totalCourses.textContent = allCourses.length;
        }

        renderCourses();
        renderContinueLearning();
        renderRecommendedLesson();
        renderCourseProgress();
        renderAchievements();

    } catch (error) {
        console.error("Courses loading error:", error);

        allCourses = [];

        if (area) {
            area.innerHTML = `
                <div class="empty-state">
                    Unable to load courses.
                    Please check your connection and refresh.
                </div>
            `;
        }
    }
}

/* ======================================================
   CONTINUE LEARNING
====================================================== */

function getSavedCourse() {
    try {
        const saved = localStorage.getItem("mwanikiLastCourse");

        return saved ? JSON.parse(saved) : null;
    } catch {
        return null;
    }
}

function renderContinueLearning() {
    const area = $("continueLearningContent");

    if (!area) {
        return;
    }

    const savedCourse = getSavedCourse();

    if (!savedCourse) {
        area.innerHTML = `
            <div class="empty-state">
                Choose a course from the library to begin learning.
            </div>
        `;

        return;
    }

    const course =
        allCourses.find(
            (item) => Number(item.id) === Number(savedCourse.id)
        ) || savedCourse;

    area.innerHTML = `
        <div class="continue-learning-card">
            <div>
                <span class="section-kicker">RECENT COURSE</span>
                <h3>${escapeHTML(course.title || "Continue Learning")}</h3>
                <p>
                    ${escapeHTML(
                        course.description ||
                        "Continue your medical learning journey."
                    )}
                </p>
            </div>

            <button
                type="button"
                class="primary-button"
                id="continueLearningButton"
            >
                Continue Course
            </button>
        </div>
    `;

    $("continueLearningButton")?.addEventListener(
        "click",
        () => openCourse(course)
    );
}

function renderRecommendedLesson() {
    const area = $("recommendedLesson");

    if (!area) {
        return;
    }

    if (!allCourses.length) {
        area.innerHTML = `
            <div class="empty-state">
                Recommendations will appear here.
            </div>
        `;

        return;
    }

    const course = allCourses[0];

    area.innerHTML = `
        <div class="recommended-card">
            <div>
                <span class="section-kicker">RECOMMENDED</span>
                <h3>${escapeHTML(course.title)}</h3>
                <p>
                    ${escapeHTML(
                        course.description ||
                        "Explore this medical course."
                    )}
                </p>
            </div>

            <button
                type="button"
                class="primary-button"
                id="recommendedLessonButton"
            >
                Start Learning
            </button>
        </div>
    `;

    $("recommendedLessonButton")?.addEventListener(
        "click",
        () => openCourse(course)
    );
}

/* ======================================================
   RECENT ACTIVITY
====================================================== */

function renderRecentlyStudied() {
    const area = $("recentlyStudied");

    if (!area) {
        return;
    }

    const savedCourse = getSavedCourse();

    if (!savedCourse) {
        area.innerHTML = `
            <div class="empty-state">
                No recent activity yet.
            </div>
        `;

        return;
    }

    const course =
        allCourses.find(
            (item) => Number(item.id) === Number(savedCourse.id)
        ) || savedCourse;

    area.innerHTML = `
        <div class="activity-item">
            <div>
                <strong>${escapeHTML(course.title || "Recent Course")}</strong>
                <span>Recently studied</span>
            </div>

            <button
                type="button"
                class="secondary-button"
                id="recentCourseOpenButton"
            >
                Continue
            </button>
        </div>
    `;

    $("recentCourseOpenButton")?.addEventListener(
        "click",
        () => openCourse(course)
    );
}

function setupRecentActivity() {
    $("clearRecentActivity")?.addEventListener(
        "click",
        () => {
            localStorage.removeItem("mwanikiLastCourse");
            renderRecentlyStudied();

            showMessage("Recent activity cleared.");
        }
    );
}

/* ======================================================
   NOTES
====================================================== */

function normalizeUnitNote(unit) {
    const content =
        unit.notes_content ||
        unit.notes ||
        "";

    if (!content || !String(content).trim()) {
        return null;
    }

    return {
        id: `unit-${unit.id}`,
        source: "unit",
        course: unit.course_title || "Medical Course",
        course_id: unit.course_id,
        unit: unit.title || "Study Unit",
        file_name: unit.title || "Unit Notes",
        file_url: "",
        content: String(content),
        created_at: unit.created_at || null
    };
}

function normalizeUploadedNote(note) {
    return {
        id: `uploaded-${note.id}`,
        source: "uploaded",
        course: note.course || "Medical Course",
        course_id: note.course_id || null,
        unit: note.unit || "Study Unit",
        file_name: note.file_name || "Study Note",
        file_url: note.file_url || "",
        content: "",
        created_at: note.created_at || null
    };
}

function createNoteCard(note) {
    const title =
        note.file_name ||
        note.unit ||
        "Study Note";

    const course =
        note.course ||
        "Medical Course";

    const unit =
        note.unit ||
        "Study Unit";

    const date = note.created_at
        ? new Date(note.created_at).toLocaleDateString("en-KE")
        : "";

    const contentPreview = note.content
        ? String(note.content).slice(0, 240)
        : "";

    let action = "";

    if (note.file_url) {
        action = `
            <a
                class="note-card-button"
                href="${escapeHTML(note.file_url)}"
                target="_blank"
                rel="noopener noreferrer"
            >
                Open Note
            </a>
        `;
    } else if (note.content) {
        action = `
            <button
                type="button"
                class="note-card-button"
                data-note-id="${escapeHTML(note.id)}"
            >
                Read Notes
            </button>
        `;
    } else {
        action = `
            <span class="note-card-button">
                Note Unavailable
            </span>
        `;
    }

    return `
        <article class="note-card">
            <h3>${escapeHTML(title)}</h3>

            <div class="note-card-meta">
                <span class="note-tag">
                    ${escapeHTML(course)}
                </span>

                <span class="note-tag">
                    ${escapeHTML(unit)}
                </span>
            </div>

            ${
                contentPreview
                    ? `
                        <p class="note-preview">
                            ${escapeHTML(contentPreview)}
                            ${note.content.length > 240 ? "..." : ""}
                        </p>
                    `
                    : ""
            }

            <span class="note-card-date">
                ${escapeHTML(date)}
            </span>

            ${action}
        </article>
    `;
}

function renderNotes(notes = allNotes) {
    const area = $("notesArea");

    if (!area) {
        return;
    }

    if (!notes.length) {
        area.innerHTML = `
            <div class="empty-state">
                <strong>No published notes found.</strong>
                <span>
                    Published study materials will appear here.
                </span>
            </div>
        `;

        return;
    }

    area.innerHTML = `
        <div class="notes-grid">
            ${notes.map(createNoteCard).join("")}
        </div>
    `;

    area.querySelectorAll("[data-note-id]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                const note = allNotes.find(
                    (item) => String(item.id) === String(button.dataset.noteId)
                );

                if (note) {
                    showFullNote(note);
                }
            });
        });
}

function showFullNote(note) {
    const existing = $("fullNoteOverlay");

    if (existing) {
        existing.remove();
    }

    const overlay = document.createElement("div");
    overlay.id = "fullNoteOverlay";

    Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        zIndex: "100000",
        background: "rgba(0,0,0,.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
    });

    overlay.innerHTML = `
        <div
            style="
                background:#ffffff;
                color:#102a43;
                width:min(850px,100%);
                max-height:90vh;
                overflow:auto;
                border-radius:16px;
                padding:24px;
            "
        >
            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:15px;
                "
            >
                <h2>${escapeHTML(note.title || note.file_name || note.unit)}</h2>

                <button
                    type="button"
                    id="closeFullNote"
                    style="
                        border:0;
                        background:#062b49;
                        color:white;
                        border-radius:8px;
                        padding:8px 12px;
                        cursor:pointer;
                    "
                >
                    Close
                </button>
            </div>

            <p>
                <strong>Course:</strong>
                ${escapeHTML(note.course)}
            </p>

            <p>
                <strong>Unit:</strong>
                ${escapeHTML(note.unit)}
            </p>

            <hr>

            <div
                style="
                    white-space:pre-wrap;
                    line-height:1.8;
                "
            >
                ${escapeHTML(note.content)}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    $("closeFullNote")?.addEventListener(
        "click",
        () => overlay.remove()
    );

    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            overlay.remove();
        }
    });
}

async function loadNotes() {
    const area = $("notesArea");

    if (area) {
        area.innerHTML = `
            <div class="loading-state">
                Loading notes...
            </div>
        `;
    }

    try {
        const [
            unitsResult,
            uploadedNotesResult
        ] = await Promise.all([
            supabase
                .from("units")
                .select(`
                    id,
                    course_id,
                    title,
                    notes,
                    notes_content,
                    created_at
                `)
                .order("id", {
                    ascending: true
                }),

            supabase
                .from("notes")
                .select(`
                    id,
                    course,
                    unit,
                    file_name,
                    file_url,
                    created_at,
                    course_id,
                    unit_id,
                    published
                `)
                .eq("published", true)
                .order("created_at", {
                    ascending: false
                })
        ]);

        if (unitsResult.error) {
            console.error(
                "Units notes query error:",
                unitsResult.error
            );
        }

        if (uploadedNotesResult.error) {
            console.error(
                "Uploaded notes query error:",
                uploadedNotesResult.error
            );
        }

        const units = Array.isArray(unitsResult.data)
            ? unitsResult.data
            : [];

        const uploadedNotes = Array.isArray(uploadedNotesResult.data)
            ? uploadedNotesResult.data
            : [];

        const unitNotes = units
            .map(normalizeUnitNote)
            .filter(Boolean);

        const fileNotes = uploadedNotes
            .map(normalizeUploadedNote);

        allNotes = [
            ...unitNotes,
            ...fileNotes
        ];

        renderNotes();
        renderAchievements();

        console.log(
            `📚 Notes loaded: ${allNotes.length}`
        );

    } catch (error) {
        console.error("Notes loading failed:", error);

        allNotes = [];

        if (area) {
            area.innerHTML = `
                <div class="empty-state">
                    Unable to load notes.
                    Please refresh and try again.
                </div>
            `;
        }
    }
}

/* ======================================================
   QUIZZES
====================================================== */

async function loadQuizzes() {
    try {
        const {
            data,
            error
        } = await supabase
            .from("quizzes")
            .select(`
                id,
                course_id,
                question,
                option_a,
                option_b,
                option_c,
                option_d,
                correct_answer,
                created_at,
                course,
                unit
            `)
            .order("id", {
                ascending: true
            });

        if (error) {
            throw error;
        }

        allQuizzes = Array.isArray(data) ? data : [];

        renderQuizSummary();
        renderAchievements();

        console.log(
            `📝 Quiz questions loaded: ${allQuizzes.length}`
        );

    } catch (error) {
        console.error("Quiz loading failed:", error);
        allQuizzes = [];
        renderQuizSummary();
    }
}

function calculateQuizProgress() {
    try {
        const raw = localStorage.getItem("mwanikiQuizProgress");

        if (!raw) {
            return 0;
        }

        const saved = JSON.parse(raw);

        if (typeof saved === "number") {
            return Math.max(0, Math.min(100, saved));
        }

        if (saved && typeof saved === "object") {
            const values = Object.values(saved);

            if (!values.length) {
                return 0;
            }

            let total = 0;

            values.forEach((value) => {
                if (typeof value === "number") {
                    total += Math.max(0, Math.min(100, value));
                } else if (value && typeof value === "object") {
                    const score = Number(
                        value.score ??
                        value.progress ??
                        0
                    );

                    total += Math.max(0, Math.min(100, score));
                }
            });

            return Math.round(total / values.length);
        }
    } catch (error) {
        console.warn("Quiz progress could not be read:", error);
    }

    return 0;
}

function updateQuizProgress() {
    const progress = calculateQuizProgress();

    const overallText = $("overallProgressText");
    const overallBar = $("overallProgressBar");
    const averageScore = $("averageScore");

    if (overallText) {
        overallText.textContent = `${progress}%`;
    }

    if (overallBar) {
        overallBar.style.width = `${progress}%`;
    }

    if (averageScore) {
        averageScore.textContent = `${progress}%`;
    }

    const streak = $("learningStreak");

    if (streak) {
        const savedStreak =
            localStorage.getItem("mwanikiLearningStreak") || "0";

        streak.textContent = `${savedStreak} days`;
    }
}

function renderQuizSummary() {
    const recent = $("recentQuizPerformance");
    const best = $("bestQuizScore");
    const weak = $("weakQuizAreas");

    const progress = calculateQuizProgress();

    if (recent) {
        recent.innerHTML = `
            <div class="quiz-summary-number">
                ${allQuizzes.length}
            </div>

            <span>
                Quiz questions available
            </span>
        `;
    }

    if (best) {
        best.textContent = `${progress}%`;
    }

    if (weak) {
        weak.textContent =
            progress < 60
                ? "Review your recent topics and practise more quizzes."
                : "Keep practising to strengthen your knowledge.";
    }

    updateQuizProgress();
}

function renderCourseProgress() {
    const area = $("courseProgressArea");

    if (!area) {
        return;
    }

    if (!allCourses.length) {
        area.innerHTML = `
            <div class="empty-state">
                Course progress will appear here.
            </div>
        `;

        return;
    }

    area.innerHTML = allCourses
        .slice(0, 6)
        .map((course) => {
            return `
                <div class="course-progress-item">
                    <div class="course-progress-header">
                        <strong>
                            ${escapeHTML(course.title)}
                        </strong>

                        <span>0%</span>
                    </div>

                    <div class="progress-track">
                        <div
                            class="progress-fill"
                            style="width:0%;"
                        ></div>
                    </div>
                </div>
            `;
        })
        .join("");
}

/* ======================================================
   ACHIEVEMENTS
====================================================== */

function renderAchievements() {
    const area = $("achievementIndicators");

    if (!area) {
        return;
    }

    area.innerHTML = `
        <div class="achievement-indicators">
            <span>📚 ${allCourses.length} courses available</span>
            <span>📄 ${allNotes.length} notes available</span>
            <span>📝 ${allQuizzes.length} quiz questions</span>
        </div>
    `;
}

/* ======================================================
   NAVIGATION
====================================================== */

function setupNavigation() {
    document.querySelectorAll(".nav-link[data-section]")
        .forEach((link) => {
            link.addEventListener("click", (event) => {
                const sectionID = link.dataset.section;
                const section = $(sectionID);

                if (!section) {
                    return;
                }

                event.preventDefault();

                section.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

                document
                    .querySelectorAll(".nav-link[data-section]")
                    .forEach((item) => {
                        item.classList.remove("active");
                    });

                link.classList.add("active");
            });
        });

    document.querySelectorAll(".mobile-bottom-nav a")
        .forEach((link) => {
            link.addEventListener("click", (event) => {
                const href = link.getAttribute("href");

                if (!href || !href.startsWith("#")) {
                    return;
                }

                const section = $(href.slice(1));

                if (!section) {
                    return;
                }

                event.preventDefault();

                section.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            });
        });
}

function setupScrollNavigation() {
    const sectionIDs = [
        "dashboardHome",
        "courseLibrary",
        "notesLibrary",
        "quizCenter",
        "aiTutor",
        "humanTutor",
        "studentInboxSection"
    ];

    const sections = sectionIDs
        .map((id) => $(id))
        .filter(Boolean);

    const links = document.querySelectorAll(
        ".nav-link[data-section]"
    );

    if (
        !sections.length ||
        !("IntersectionObserver" in window)
    ) {
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort(
                    (a, b) =>
                        b.intersectionRatio -
                        a.intersectionRatio
                )[0];

            if (!visible) {
                return;
            }

            links.forEach((link) => {
                link.classList.toggle(
                    "active",
                    link.dataset.section === visible.target.id
                );
            });
        },
        {
            rootMargin: "-120px 0px -55% 0px",
            threshold: [0.1, 0.25, 0.5]
        }
    );

    sections.forEach((section) => {
        observer.observe(section);
    });
}

function setupStudentProfileButton() {
    $("studentProfileButton")?.addEventListener(
        "click",
        () => {
            window.location.href = "./studentProfile.html";
        }
    );
}

function setupNotificationButton() {
    $("notificationButton")?.addEventListener(
        "click",
        () => {
            showMessage(
                "Your latest notifications will appear here."
            );
        }
    );
}

/* ======================================================
   HUMAN TUTOR MESSAGING
====================================================== */

function showTutorStatus(message, type = "") {
    const status = $("messageStatus");

    if (!status) {
        showMessage(message, type);
        return;
    }

    status.textContent = message;
    status.classList.remove("success", "error");

    if (type) {
        status.classList.add(type);
    }
}

function setupTutorMessaging() {
    const button = $("sendTutorMessageButton");

    if (!button) {
        return;
    }

    button.addEventListener("click", async () => {
        const studentName =
            $("studentName")?.value.trim() ||
            getStudentName();

        const studentEmail =
            $("studentEmail")?.value.trim() ||
            getStudentEmail();

        const topic =
            $("topic")?.value.trim() ||
            "";

        const message =
            $("studentMessage")?.value.trim() ||
            "";

        if (!topic) {
            showTutorStatus(
                "Please enter the topic.",
                "error"
            );

            $("topic")?.focus();
            return;
        }

        if (!message) {
            showTutorStatus(
                "Please write your question.",
                "error"
            );

            $("studentMessage")?.focus();
            return;
        }

        button.disabled = true;
        button.textContent = "Sending...";

        try {
            const {
                error
            } = await supabase
                .from("tutor_messages")
                .insert({
                    student_id: currentUser?.id || null,
                    student_name: studentName,
                    student_email: studentEmail,
                    topic,
                    message
                });

            if (error) {
                throw error;
            }

            showTutorStatus(
                "Message sent successfully.",
                "success"
            );

            $("topic").value = "";
            $("studentMessage").value = "";

        } catch (error) {
            console.error("Tutor message error:", error);

            showTutorStatus(
                error.message ||
                "Unable to send your message.",
                "error"
            );
        } finally {
            button.disabled = false;
            button.textContent = "📨 Send Message";
        }
    });
}

/* ======================================================
   STUDENT INBOX
====================================================== */

function renderStudentInbox(answers) {
    const inbox = $("studentInbox");

    if (!inbox) {
        return;
    }

    if (!answers.length) {
        inbox.innerHTML = `
            <div class="empty-state">
                No tutor replies found yet.
            </div>
        `;

        return;
    }

    inbox.innerHTML = answers
        .map((answer) => {
            const reply =
                answer.answer ||
                answer.message ||
                answer.reply ||
                "";

            return `
                <article class="inbox-message">
                    <h3>
                        ${escapeHTML(answer.topic || "Tutor Reply")}
                    </h3>

                    <p>${escapeHTML(reply)}</p>

                    <small>
                        ${
                            answer.created_at
                                ? escapeHTML(
                                    new Date(
                                        answer.created_at
                                    ).toLocaleString("en-KE")
                                )
                                : ""
                        }
                    </small>
                </article>
            `;
        })
        .join("");
}

function setupStudentInbox() {
    const button = $("loadAnswersButton");

    if (!button) {
        return;
    }

    button.addEventListener("click", async () => {
        const email =
            $("checkEmail")?.value.trim() ||
            getStudentEmail();

        if (!email) {
            showMessage("Please enter your email address.", "error");
            return;
        }

        button.disabled = true;
        button.textContent = "Loading...";

        try {
            const {
                data,
                error
            } = await supabase
                .from("tutor_answers")
                .select("*")
                .eq("student_email", email)
                .order("created_at", {
                    ascending: false
                });

            if (error) {
                throw error;
            }

            renderStudentInbox(
                Array.isArray(data) ? data : []
            );

        } catch (error) {
            console.error("Inbox loading error:", error);

            const inbox = $("studentInbox");

            if (inbox) {
                inbox.innerHTML = `
                    <div class="empty-state">
                        Unable to load tutor replies.
                    </div>
                `;
            }
        } finally {
            button.disabled = false;
            button.textContent = "📬 Load Answers";
        }
    });
}

/* ======================================================
   SEARCH
====================================================== */

function setupCourseSearch() {
    const input = $("courseSearch");

    if (!input) {
        return;
    }

    input.addEventListener("input", () => {
        const query = input.value.trim().toLowerCase();

        if (!query) {
            renderCourses();
            return;
        }

        const filtered = allCourses.filter((course) => {
            const title = String(course.title || "").toLowerCase();
            const description = String(
                course.description || ""
            ).toLowerCase();

            return (
                title.includes(query) ||
                description.includes(query)
            );
        });

        renderCourses(filtered);
    });
}

function setupNotesSearch() {
    const input = $("notesSearch");

    if (!input) {
        return;
    }

    input.addEventListener("input", () => {
        const query = input.value.trim().toLowerCase();

        if (!query) {
            renderNotes();
            return;
        }

        const filtered = allNotes.filter((note) => {
            const searchableText = [
                note.file_name,
                note.course,
                note.unit,
                note.content
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchableText.includes(query);
        });

        renderNotes(filtered);
    });
}

/* ======================================================
   WHATSAPP
====================================================== */

function setupWhatsAppButton() {
    document.querySelectorAll(".whatsapp-float")
        .forEach((link) => {
            link.addEventListener("click", () => {
                console.log(
                    "Opening Mwaniki Scholars WhatsApp Channel"
                );
            });
        });
}

/* ======================================================
   COURSE AND UNIT TRACKING
====================================================== */

window.mwanikiTrackUnit = function (
    courseId,
    unitId,
    unitTitle
) {
    if (courseId !== undefined && courseId !== null) {
        localStorage.setItem(
            "selectedCourse",
            String(courseId)
        );
    }

    if (unitId !== undefined && unitId !== null) {
        localStorage.setItem(
            "selectedUnit",
            String(unitId)
        );
    }

    if (unitTitle) {
        localStorage.setItem(
            "selectedUnitTitle",
            String(unitTitle)
        );
    }
};

/* ======================================================
   PUBLIC DASHBOARD API
====================================================== */

window.mwanikiDashboard = {
    getCurrentUser() {
        return currentUser;
    },

    getCurrentStudent() {
        return currentStudent;
    },

    getCourses() {
        return allCourses;
    },

    getNotes() {
        return allNotes;
    },

    getQuizzes() {
        return allQuizzes;
    },

    async refresh() {
        await Promise.all([
            loadCourses(),
            loadNotes(),
            loadQuizzes()
        ]);

        renderRecentlyStudied();
        renderAchievements();
    }
};

/* ======================================================
   AUTH LISTENER
====================================================== */

function setupAuthListener() {
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
            window.location.href = "./index.html";
            return;
        }

        if (
            (
                event === "SIGNED_IN" ||
                event === "TOKEN_REFRESHED"
            ) &&
            session?.user
        ) {
            currentUser = session.user;
            updateStudentIdentity();
            updateStudentPhoto();
        }
    });
}

/* ======================================================
   INITIALIZE
====================================================== */

async function initializeDashboard() {
    console.log(
        "🚀 Initializing Mwaniki Scholars dashboard..."
    );

    updateCurrentDate();

    setupNavigation();
    setupScrollNavigation();
    setupStudentProfileButton();
    setupNotificationButton();
    setupTutorMessaging();
    setupStudentInbox();
    setupCourseSearch();
    setupNotesSearch();
    setupRecentActivity();
    setupWhatsAppButton();
    setupAuthListener();

    const authenticated = await loadStudentProfile();

    if (!authenticated) {
        return;
    }

    await Promise.all([
        loadCourses(),
        loadNotes(),
        loadQuizzes()
    ]);

    updateQuizProgress();
    renderRecentlyStudied();
    renderAchievements();

    if (window.location.hash) {
        const hashID = window.location.hash.replace("#", "");
        const target = $(hashID);

        if (target) {
            setTimeout(() => {
                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }, 300);
        }
    }

    console.log(
        "✅ Mwaniki Scholars dashboard ready"
    );
}

/* ======================================================
   START
====================================================== */

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard,
        {
            once: true
        }
    );
} else {
    initializeDashboard();
}
