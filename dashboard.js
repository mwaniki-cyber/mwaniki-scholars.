import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS
// STUDENT DASHBOARD ENGINE
// =====================================================

console.log("🚀 Mwaniki Scholars Dashboard JS loaded");

// =====================================================
// STORAGE KEYS
// =====================================================

const STORAGE_KEYS = {
    recent: "mwanikiRecentActivity",
    quizHistory: "mwanikiQuizHistory",
    quizProgress: "mwanikiQuizProgress",
    lastActivity: "mwanikiLastActivity",
    streak: "mwanikiLearningStreak"
};

// =====================================================
// GLOBAL STATE
// =====================================================

let currentUser = null;
let currentStudent = null;

let allNotes = [];


// =====================================================
// SAFE TEXT
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
// SAFE LOCAL STORAGE
// =====================================================

function readStorage(key, fallback = []) {

    try {

        const value = localStorage.getItem(key);

        if (!value) {
            return fallback;
        }

        return JSON.parse(value);

    } catch (error) {

        console.warn(
            `⚠️ Could not read localStorage key "${key}"`,
            error
        );

        return fallback;
    }
}


// =====================================================
// CURRENT USER
// =====================================================

async function getCurrentUser() {

    try {

        const {
            data,
            error
        } = await supabase.auth.getSession();

        if (error) {

            console.error(
                "❌ Supabase session error:",
                error
            );

            return null;
        }

        return data?.session?.user || null;

    } catch (error) {

        console.error(
            "❌ Failed to get current user:",
            error
        );

        return null;
    }
}


// =====================================================
// STUDENT PROFILE
// =====================================================

async function loadStudentProfile() {

    currentUser = await getCurrentUser();

    if (!currentUser) {

        console.warn(
            "⚠️ No authenticated student session found."
        );

        showLoggedOutState();

        return;
    }

    try {

        console.log(
            "👤 Loading student profile:",
            currentUser.id
        );

        const {
            data,
            error
        } = await supabase
            .from("students")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) {

            console.error(
                "❌ STUDENT PROFILE ERROR:",
                error
            );

            currentStudent = null;

        } else {

            currentStudent = data;

        }

        renderStudentProfile();

    } catch (error) {

        console.error(
            "❌ Unexpected profile error:",
            error
        );

        currentStudent = null;

        renderStudentProfile();
    }

    // -------------------------------------------------
    // Dashboard systems
    // -------------------------------------------------

    updateDashboardAnalytics();

    setupDashboardNavigation();

    setupAIQuestions();

    updateLearningStreak();

    renderRecentActivity();

    updateNotifications();

    setupClearRecentActivity();

    updateContinueLearning();

    updateRecommendedLesson();

    updateQuizAnalytics();

    updateAchievements();
}


// =====================================================
// LOGGED OUT STATE
// =====================================================

function showLoggedOutState() {

    const profileArea =
        document.getElementById("studentPersonalProfile");

    if (profileArea) {

        profileArea.innerHTML = `
            <div class="profile-empty-state">

                <h2>Welcome to Mwaniki Scholars</h2>

                <p>
                    Please sign in to access your student dashboard.
                </p>

            </div>
        `;
    }
}


// =====================================================
// STUDENT PROFILE RENDERING
// =====================================================

function renderStudentProfile() {

    if (!currentStudent) {

        console.warn(
            "ℹ️ No student profile record available."
        );

        return;
    }

    const firstName =
        currentStudent.first_name ||
        currentStudent.firstname ||
        currentStudent.name ||
        currentStudent.full_name ||
        "Student";

    const email =
        currentStudent.email ||
        currentUser?.email ||
        "";

    const nameElements = [
        "studentName",
        "dashboardStudentName",
        "profileStudentName",
        "heroStudentName"
    ];

    nameElements.forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {
            element.textContent = firstName;
        }

    });

    const emailElements = [
        "studentEmail",
        "profileStudentEmail",
        "heroStudentEmail"
    ];

    emailElements.forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {
            element.textContent = email;
        }

    });

    const greeting =
        document.getElementById("studentGreeting");

    if (greeting) {

        greeting.textContent =
            `Welcome back, ${firstName}`;
    }

    const profileArea =
        document.getElementById("studentPersonalProfile");

    if (profileArea) {

        profileArea.classList.add(
            "profile-loaded"
        );
    }
}


// =====================================================
// DASHBOARD ANALYTICS
// =====================================================

function updateDashboardAnalytics() {

    const quizHistory =
        readStorage(
            STORAGE_KEYS.quizHistory,
            []
        );

    const recent =
        readStorage(
            STORAGE_KEYS.recent,
            []
        );

    // -------------------------------------------------
    // Quiz attempts
    // -------------------------------------------------

    const quizzesAttempted =
        document.getElementById(
            "quizzesAttempted"
        );

    if (quizzesAttempted) {

        quizzesAttempted.textContent =
            quizHistory.length;
    }

    // -------------------------------------------------
    // Average score
    // -------------------------------------------------

    const averageScoreElement =
        document.getElementById(
            "averageScore"
        );

    if (averageScoreElement) {

        if (quizHistory.length === 0) {

            averageScoreElement.textContent =
                "0%";

        } else {

            const scores =
                quizHistory
                    .map(item =>
                        Number(
                            item.score ??
                            item.percentage ??
                            0
                        )
                    )
                    .filter(score =>
                        Number.isFinite(score)
                    );

            const average =
                scores.length
                    ? Math.round(
                        scores.reduce(
                            (sum, score) =>
                                sum + score,
                            0
                        ) / scores.length
                    )
                    : 0;

            averageScoreElement.textContent =
                `${average}%`;
        }
    }

    // -------------------------------------------------
    // Units completed
    // -------------------------------------------------

    const unitsCompleted =
        document.getElementById(
            "unitsCompleted"
        );

    if (unitsCompleted) {

        unitsCompleted.textContent =
            recent.filter(item =>
                item.type === "unit" &&
                (
                    item.completed === true ||
                    item.action === "completed"
                )
            ).length;
    }

    // -------------------------------------------------
    // Courses completed
    // -------------------------------------------------

    const coursesCompleted =
        document.getElementById(
            "coursesCompleted"
        );

    if (coursesCompleted) {

        const completedCourses =
            new Set(
                recent
                    .filter(item =>
                        item.type === "course" &&
                        (
                            item.completed === true ||
                            item.action === "completed"
                        )
                    )
                    .map(item =>
                        item.courseId ||
                        item.course_id
                    )
                    .filter(Boolean)
            );

        coursesCompleted.textContent =
            completedCourses.size;
    }
}


// =====================================================
// RECENT ACTIVITY
// =====================================================

function renderRecentActivity() {

    const container =
        document.getElementById(
            "recentlyStudied"
        );

    if (!container) {
        return;
    }

    const recent =
        readStorage(
            STORAGE_KEYS.recent,
            []
        );

    if (!recent.length) {

        container.innerHTML = `
            <div class="empty-state">
                <h3>📚 No recent activity</h3>

                <p>
                    Start studying a course to see
                    your recent activity here.
                </p>
            </div>
        `;

        return;
    }

    const latest =
        recent.slice(0, 6);

    container.innerHTML =
        latest.map(item => {

            const title =
                item.title ||
                item.unitTitle ||
                item.courseName ||
                "Medical Learning";

            const course =
                item.courseName ||
                item.course ||
                "";

            return `
                <div class="recent-activity-item">

                    <div class="recent-activity-icon">
                        📖
                    </div>

                    <div class="recent-activity-content">

                        <strong>
                            ${escapeHTML(title)}
                        </strong>

                        ${
                            course
                                ? `
                                    <small>
                                        ${escapeHTML(course)}
                                    </small>
                                `
                                : ""
                        }

                    </div>

                </div>
            `;

        }).join("");
}


// =====================================================
// TRACK UNIT ACTIVITY
// =====================================================

window.mwanikiTrackUnit = function (
    unit
) {

    try {

        const recent =
            readStorage(
                STORAGE_KEYS.recent,
                []
            );

        const entry = {

            type: "unit",

            title:
                unit?.title ||
                unit?.unitTitle ||
                "Medical Unit",

            unitId:
                unit?.id ||
                unit?.unitId ||
                null,

            unitTitle:
                unit?.title ||
                unit?.unitTitle ||
                "",

            courseId:
                unit?.course_id ||
                unit?.courseId ||
                null,

            courseName:
                unit?.courseName ||
                "",

            completed:
                Boolean(
                    unit?.completed
                ),

            timestamp:
                new Date().toISOString()
        };

        recent.unshift(entry);

        localStorage.setItem(
            STORAGE_KEYS.recent,
            JSON.stringify(
                recent.slice(0, 50)
            )
        );

        localStorage.setItem(
            STORAGE_KEYS.lastActivity,
            new Date().toISOString()
        );

        renderRecentActivity();

        updateDashboardAnalytics();

    } catch (error) {

        console.error(
            "❌ Could not track activity:",
            error
        );
    }
};


// =====================================================
// CONTINUE LEARNING
// =====================================================

function updateContinueLearning() {

    const container =
        document.getElementById(
            "continueLearning"
        );

    if (!container) {
        return;
    }

    const recent =
        readStorage(
            STORAGE_KEYS.recent,
            []
        );

    const latest =
        recent.find(item =>
            item &&
            (
                item.courseId ||
                item.course_id
            )
        );

    if (!latest) {

        container.innerHTML = `
            <div class="empty-state">

                <h3>🚀 Start your learning journey</h3>

                <p>
                    Choose a course from the Course Library.
                </p>

            </div>
        `;

        return;
    }

    const courseId =
        latest.courseId ||
        latest.course_id;

    const courseName =
        latest.courseName ||
        latest.course ||
        "Medical Course";

    container.innerHTML = `

        <div class="continue-learning-card">

            <div>

                <span>
                    Continue Learning
                </span>

                <h3>
                    ${escapeHTML(courseName)}
                </h3>

                <p>
                    Pick up where you left off.
                </p>

            </div>

            <button
                type="button"
                class="continue-course-button"
                data-course-id="${escapeHTML(courseId)}"
            >
                Continue →
            </button>

        </div>
    `;

    const button =
        container.querySelector(
            ".continue-course-button"
        );

    if (button) {

        button.addEventListener(
            "click",
            () => {

                localStorage.setItem(
                    "selectedCourse",
                    String(courseId)
                );

                localStorage.setItem(
                    "selectedCourseName",
                    courseName
                );

                window.location.href =
                    "course.html";
            }
        );
    }
}


// =====================================================
// RECOMMENDED LESSON
// =====================================================

function updateRecommendedLesson() {

    const container =
        document.getElementById(
            "recommendedLesson"
        );

    if (!container) {
        return;
    }

    container.innerHTML = `

        <div class="recommended-lesson-card">

            <div class="recommended-icon">
                🧠
            </div>

            <div>

                <span>
                    Recommended
                </span>

                <h3>
                    Keep building your medical knowledge
                </h3>

                <p>
                    Explore a course and complete a unit
                    to strengthen your learning progress.
                </p>

            </div>

        </div>
    `;
}


// =====================================================
// QUIZ ANALYTICS
// =====================================================

function updateQuizAnalytics() {

    const history =
        readStorage(
            STORAGE_KEYS.quizHistory,
            []
        );

    const bestScore =
        document.getElementById(
            "bestQuizScore"
        );

    if (bestScore) {

        const scores =
            history
                .map(item =>
                    Number(
                        item.score ??
                        item.percentage ??
                        0
                    )
                )
                .filter(
                    score =>
                        Number.isFinite(score)
                );

        bestScore.textContent =
            scores.length
                ? `${Math.max(...scores)}%`
                : "0%";
    }

    const recentPerformance =
        document.getElementById(
            "recentQuizPerformance"
        );

    if (recentPerformance) {

        if (!history.length) {

            recentPerformance.innerHTML = `
                <div class="empty-state">
                    No quiz attempts yet.
                </div>
            `;

        } else {

            recentPerformance.innerHTML =
                history
                    .slice(0, 5)
                    .map(item => {

                        const title =
                            item.title ||
                            item.course ||
                            "Quiz";

                        const score =
                            Number(
                                item.score ??
                                item.percentage ??
                                0
                            );

                        return `
                            <div class="quiz-performance-item">

                                <strong>
                                    ${escapeHTML(title)}
                                </strong>

                                <span>
                                    ${score}%
                                </span>

                            </div>
                        `;

                    })
                    .join("");
        }
    }

    const unfinished =
        document.getElementById(
            "unfinishedQuiz"
        );

    if (unfinished) {

        const progress =
            readStorage(
                STORAGE_KEYS.quizProgress,
                {}
            );

        const keys =
            Object.keys(progress);

        if (!keys.length) {

            unfinished.innerHTML = `
                <div class="empty-state">
                    No unfinished quizzes.
                </div>
            `;

        } else {

            unfinished.innerHTML = `
                <div class="unfinished-quiz-card">

                    <h3>
                        📝 Unfinished Quiz
                    </h3>

                    <p>
                        You have quiz progress saved.
                    </p>

                </div>
            `;
        }
    }
}


// =====================================================
// ACHIEVEMENTS
// =====================================================

function updateAchievements() {

    const container =
        document.getElementById(
            "achievementIndicators"
        );

    if (!container) {
        return;
    }

    const history =
        readStorage(
            STORAGE_KEYS.quizHistory,
            []
        );

    const recent =
        readStorage(
            STORAGE_KEYS.recent,
            []
        );

    const quizAchievement =
        history.length >= 1;

    const unitAchievement =
        recent.some(item =>
            item.type === "unit"
        );

    container.innerHTML = `

        <div class="achievement-grid">

            <div class="achievement-card ${
                quizAchievement
                    ? "earned"
                    : ""
            }">

                <div class="achievement-icon">
                    📝
                </div>

                <strong>
                    First Quiz
                </strong>

                <span>
                    ${
                        quizAchievement
                            ? "Earned"
                            : "Locked"
                    }
                </span>

            </div>

            <div class="achievement-card ${
                unitAchievement
                    ? "earned"
                    : ""
            }">

                <div class="achievement-icon">
                    📚
                </div>

                <strong>
                    First Lesson
                </strong>

                <span>
                    ${
                        unitAchievement
                            ? "Earned"
                            : "Locked"
                    }
                </span>

            </div>

        </div>
    `;
}


// =====================================================
// LEARNING STREAK
// =====================================================

function updateLearningStreak() {

    const streakElement =
        document.getElementById(
            "learningStreak"
        );

    if (!streakElement) {
        return;
    }

    const stored =
        readStorage(
            STORAGE_KEYS.streak,
            null
        );

    let streak = 0;

    if (
        typeof stored === "number"
    ) {

        streak = stored;

    } else if (
        stored &&
        typeof stored.streak === "number"
    ) {

        streak = stored.streak;
    }

    streakElement.textContent =
        `${streak} day${streak === 1 ? "" : "s"}`;
}


// =====================================================
// =====================================================
// NOTES LIBRARY
// =====================================================
// THIS WAS THE MISSING PART
// =====================================================
// =====================================================

async function loadNotesLibrary() {

    const notesArea =
        document.getElementById(
            "notesArea"
        );

    if (!notesArea) {

        console.log(
            "ℹ️ Notes library skipped: notesArea not found"
        );

        return;
    }

    // -------------------------------------------------
    // INITIAL LOADING STATE
    // -------------------------------------------------

    notesArea.innerHTML = `

        <div class="loading-card">

            <div class="loading-spinner"></div>

            <p>
                Loading notes...
            </p>

        </div>
    `;

    try {

        console.log(
            "📚 Loading published notes from Supabase..."
        );

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
                course_id,
                unit_id,
                published
            `)
            .eq(
                "published",
                true
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        // -------------------------------------------------
        // DATABASE ERROR
        // -------------------------------------------------

        if (error) {

            console.error(
                "❌ NOTES DATABASE ERROR:",
                error
            );

            allNotes = [];

            notesArea.innerHTML = `

                <div class="notes-error-card">

                    <div style="
                        font-size:42px;
                        margin-bottom:10px;
                    ">
                        ⚠️
                    </div>

                    <h3>
                        Unable to load notes
                    </h3>

                    <p>
                        ${escapeHTML(
                            error.message ||
                            "Supabase could not load the notes."
                        )}
                    </p>

                    <button
                        type="button"
                        id="retryNotesButton"
                        class="retry-notes-button"
                    >
                        🔄 Try Again
                    </button>

                </div>
            `;

            const retryButton =
                document.getElementById(
                    "retryNotesButton"
                );

            if (retryButton) {

                retryButton.addEventListener(
                    "click",
                    loadNotesLibrary
                );
            }

            return;
        }

        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        allNotes =
            Array.isArray(data)
                ? data
                : [];

        console.log(
            `📚 Notes returned: ${allNotes.length}`
        );

        console.log(
            "📚 Notes data:",
            allNotes
        );

        // -------------------------------------------------
        // EMPTY
        // -------------------------------------------------

        if (allNotes.length === 0) {

            notesArea.innerHTML = `

                <div class="notes-empty-card">

                    <div style="
                        font-size:48px;
                        margin-bottom:12px;
                    ">
                        📚
                    </div>

                    <h3>
                        No published notes yet
                    </h3>

                    <p>
                        Notes uploaded by the administrator
                        will appear here once they are published.
                    </p>

                </div>
            `;

            return;
        }

        // -------------------------------------------------
        // RENDER
        // -------------------------------------------------

        renderNotes(allNotes);

        // -------------------------------------------------
        // SEARCH
        // -------------------------------------------------

        setupNotesSearch();

        console.log(
            `✅ ${allNotes.length} notes displayed`
        );

    } catch (error) {

        // -------------------------------------------------
        // IMPORTANT:
        // NEVER LEAVE "LOADING NOTES..." FOREVER
        // -------------------------------------------------

        console.error(
            "❌ Unexpected notes error:",
            error
        );

        allNotes = [];

        notesArea.innerHTML = `

            <div class="notes-error-card">

                <div style="
                    font-size:42px;
                    margin-bottom:10px;
                ">
                    ❌
                </div>

                <h3>
                    Something went wrong
                </h3>

                <p>
                    ${escapeHTML(
                        error?.message ||
                        "An unexpected error occurred while loading notes."
                    )}
                </p>

                <button
                    type="button"
                    id="retryNotesButton"
                    class="retry-notes-button"
                >
                    🔄 Try Again
                </button>

            </div>
        `;

        const retryButton =
            document.getElementById(
                "retryNotesButton"
            );

        if (retryButton) {

            retryButton.addEventListener(
                "click",
                loadNotesLibrary
            );
        }
    }
}


// =====================================================
// RENDER NOTES
// =====================================================

function renderNotes(notes) {

    const notesArea =
        document.getElementById(
            "notesArea"
        );

    if (!notesArea) {
        return;
    }

    if (!notes || notes.length === 0) {

        notesArea.innerHTML = `

            <div class="notes-empty-card">

                <div style="
                    font-size:48px;
                    margin-bottom:12px;
                ">
                    🔎
                </div>

                <h3>
                    No notes found
                </h3>

                <p>
                    Try another search term.
                </p>

            </div>
        `;

        return;
    }

    notesArea.innerHTML = `

        <div class="notes-library-grid">

            ${notes.map(note => {

                const fileName =
                    note.file_name ||
                    "Medical Notes";

                const course =
                    note.course ||
                    "Medical Course";

                const unit =
                    note.unit ||
                    "Study Material";

                const fileUrl =
                    note.file_url ||
                    "";

                let formattedDate = "";

                if (note.created_at) {

                    try {

                        formattedDate =
                            new Date(
                                note.created_at
                            ).toLocaleDateString(
                                undefined,
                                {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric"
                                }
                            );

                    } catch {
                        formattedDate = "";
                    }
                }

                return `

                    <article
                        class="note-card"
                        data-note-search="${escapeHTML(
                            `${fileName} ${course} ${unit}`
                        )}"
                    >

                        <div class="note-card-icon">
                            📄
                        </div>

                        <div class="note-card-content">

                            <h3>
                                ${escapeHTML(fileName)}
                            </h3>

                            <p class="note-course">
                                📚 ${escapeHTML(course)}
                            </p>

                            <p class="note-unit">
                                📖 ${escapeHTML(unit)}
                            </p>

                            ${
                                formattedDate
                                    ? `
                                        <small class="note-date">
                                            Added ${escapeHTML(
                                                formattedDate
                                            )}
                                        </small>
                                    `
                                    : ""
                            }

                            ${
                                fileUrl
                                    ? `
                                        <a
                                            class="open-note-button"
                                            href="${escapeHTML(fileUrl)}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            📖 Open Notes
                                        </a>
                                    `
                                    : `
                                        <span
                                            class="note-unavailable"
                                        >
                                            ⚠️ File unavailable
                                        </span>
                                    `
                            }

                        </div>

                    </article>
                `;

            }).join("")}

        </div>
    `;
}


// =====================================================
// NOTES SEARCH
// =====================================================

function setupNotesSearch() {

    const search =
        document.getElementById(
            "notesSearch"
        );

    if (!search) {

        console.log(
            "ℹ️ notesSearch input not found"
        );

        return;
    }

    // -------------------------------------------------
    // Prevent duplicate listeners
    // -------------------------------------------------

    if (
        search.dataset.notesSearchReady === "true"
    ) {

        return;
    }

    search.dataset.notesSearchReady =
        "true";

    search.addEventListener(
        "input",
        function () {

            const term =
                this.value
                    .toLowerCase()
                    .trim();

            const filtered =
                allNotes.filter(note => {

                    const searchableText = [

                        note.file_name,

                        note.course,

                        note.unit

                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                    return searchableText.includes(
                        term
                    );
                });

            renderNotes(filtered);
        }
    );
}


// =====================================================
// DASHBOARD NAVIGATION
// =====================================================

function setupDashboardNavigation() {

    const sections =
        document.querySelectorAll(
            ".dashboard-section"
        );

    const navLinks =
        document.querySelectorAll(
            ".nav-link[data-section]"
        );

    const mobileLinks =
        document.querySelectorAll(
            ".mobile-nav-link[data-section]"
        );

    if (!sections.length) {
        return;
    }

    function showSection(
        sectionId
    ) {

        sections.forEach(section => {

            section.style.display =
                section.id === sectionId
                    ? "block"
                    : "none";

        });

        navLinks.forEach(link => {

            link.classList.toggle(
                "active",
                link.dataset.section === sectionId
            );

        });

        mobileLinks.forEach(link => {

            link.classList.toggle(
                "active",
                link.dataset.section === sectionId
            );

        });

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        // -------------------------------------------------
        // Reload notes when opening Notes Library
        // -------------------------------------------------

        if (
            sectionId === "notesLibrary" &&
            allNotes.length === 0
        ) {

            loadNotesLibrary();
        }
    }

    navLinks.forEach(link => {

        link.addEventListener(
            "click",
            event => {

                event.preventDefault();

                const sectionId =
                    link.dataset.section;

                if (sectionId) {

                    showSection(
                        sectionId
                    );

                    history.replaceState(
                        null,
                        "",
                        `#${sectionId}`
                    );
                }
            }
        );
    });

    mobileLinks.forEach(link => {

        link.addEventListener(
            "click",
            event => {

                event.preventDefault();

                const sectionId =
                    link.dataset.section;

                if (sectionId) {

                    showSection(
                        sectionId
                    );

                    history.replaceState(
                        null,
                        "",
                        `#${sectionId}`
                    );
                }
            }
        );
    });

    // -------------------------------------------------
    // Initial hash
    // -------------------------------------------------

    const hash =
        window.location.hash.replace(
            "#",
            ""
        );

    if (
        hash &&
        document.getElementById(hash)
    ) {

        showSection(hash);

    } else {

        const home =
            document.getElementById(
                "dashboardHome"
            );

        if (home) {

            showSection(
                "dashboardHome"
            );
        }
    }
}


// =====================================================
// AI QUESTIONS
// =====================================================

function setupAIQuestions() {

    const questionInput =
        document.getElementById(
            "aiQuestion"
        );

    const askButton =
        document.getElementById(
            "askAIButton"
        );

    if (!questionInput || !askButton) {
        return;
    }

    document
        .querySelectorAll(
            ".ai-suggestion"
        )
        .forEach(button => {

            if (
                button.dataset.aiReady === "true"
            ) {
                return;
            }

            button.dataset.aiReady =
                "true";

            button.addEventListener(
                "click",
                () => {

                    questionInput.value =
                        button.textContent
                            .trim();

                    questionInput.focus();
                }
            );
        });
}


// =====================================================
// CLEAR RECENT ACTIVITY
// =====================================================

function setupClearRecentActivity() {

    const button =
        document.getElementById(
            "clearRecentActivity"
        );

    if (!button) {
        return;
    }

    if (
        button.dataset.clearReady === "true"
    ) {
        return;
    }

    button.dataset.clearReady =
        "true";

    button.addEventListener(
        "click",
        () => {

            localStorage.removeItem(
                STORAGE_KEYS.recent
            );

            renderRecentActivity();

            updateDashboardAnalytics();

            updateContinueLearning();

            updateAchievements();
        }
    );
}


// =====================================================
// NOTIFICATIONS
// =====================================================

function updateNotifications() {

    const badge =
        document.getElementById(
            "notificationBadge"
        );

    if (!badge) {
        return;
    }

    const recent =
        readStorage(
            STORAGE_KEYS.recent,
            []
        );

    const count =
        recent.length > 0
            ? Math.min(
                recent.length,
                9
            )
            : 0;

    badge.textContent =
        count > 0
            ? String(count)
            : "";

    badge.style.display =
        count > 0
            ? "flex"
            : "none";
}


// =====================================================
// NOTIFICATION BUTTON
// =====================================================

function setupNotificationButton() {

    const button =
        document.getElementById(
            "notificationButton"
        );

    if (!button) {
        return;
    }

    if (
        button.dataset.notificationReady === "true"
    ) {
        return;
    }

    button.dataset.notificationReady =
        "true";

    button.addEventListener(
        "click",
        () => {

            const inbox =
                document.getElementById(
                    "studentInboxSection"
                );

            if (inbox) {

                document
                    .querySelectorAll(
                        ".dashboard-section"
                    )
                    .forEach(section => {

                        section.style.display =
                            section.id ===
                            "studentInboxSection"
                                ? "block"
                                : "none";
                    });

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        }
    );
}


// =====================================================
// PROFILE BUTTON
// =====================================================

function setupProfileButton() {

    const button =
        document.getElementById(
            "studentProfileButton"
        );

    if (!button) {
        return;
    }

    if (
        button.dataset.profileReady === "true"
    ) {
        return;
    }

    button.dataset.profileReady =
        "true";

    button.addEventListener(
        "click",
        () => {

            window.location.href =
                "studentProfile.html";
        }
    );
}


// =====================================================
// GLOBAL DASHBOARD API
// =====================================================

window.mwanikiDashboard = {

    reloadNotes:
        loadNotesLibrary,

    reloadCourses:
        () => {

            if (
                typeof window.loadCourses ===
                "function"
            ) {

                window.loadCourses();
            }
        },

    refresh:
        async function () {

            await loadNotesLibrary();

            updateDashboardAnalytics();

            renderRecentActivity();

            updateQuizAnalytics();

            updateAchievements();

            updateContinueLearning();
        }
};


// =====================================================
// INITIALIZATION
// =====================================================

async function initializeDashboard() {

    console.log(
        "🚀 Initializing Mwaniki Scholars dashboard..."
    );

    // -------------------------------------------------
    // IMPORTANT:
    // Notes load independently.
    // They do NOT wait for student profile.
    // -------------------------------------------------

    loadNotesLibrary();

    // -------------------------------------------------
    // Profile / analytics
    // -------------------------------------------------

    await loadStudentProfile();

    // -------------------------------------------------
    // Buttons
    // -------------------------------------------------

    setupNotificationButton();

    setupProfileButton();

    console.log(
        "✅ Mwaniki Scholars dashboard initialized"
    );
}


// =====================================================
// START
// =====================================================

initializeDashboard();
