import { supabase } from "./supabase.js";

// ============================================================
// MWANIKI SCHOLARS
// PREMIUM STUDENT DASHBOARD ENGINE
// ============================================================

console.log(
    "🎓 Mwaniki Scholars Premium Dashboard Loaded"
);

// ============================================================
// STORAGE KEYS
// ============================================================

const STORAGE = {

    recent:
        "mwanikiRecentActivity",

    quizHistory:
        "mwanikiQuizHistory",

    quizProgress:
        "mwanikiQuizProgress",

    lastActivity:
        "mwanikiLastActivity",

    streak:
        "mwanikiLearningStreak"

};

// ============================================================
// CURRENT USER
// ============================================================

let currentUser = null;

let currentStudent = null;

// ============================================================
// NOTES STATE
// ============================================================

let allNotes = [];

let notesSearchReady = false;

// ============================================================
// GET SESSION
// ============================================================

async function getCurrentUser() {

    try {

        const {
            data,
            error
        } = await supabase.auth.getSession();

        if (error) {

            console.error(
                "❌ Session error:",
                error
            );

            return null;
        }

        if (
            !data ||
            !data.session ||
            !data.session.user
        ) {

            console.warn(
                "⚠️ No active Supabase session."
            );

            return null;
        }

        return data.session.user;

    } catch (error) {

        console.error(
            "❌ Unexpected session error:",
            error
        );

        return null;
    }
}

// ============================================================
// LOAD STUDENT PROFILE
// ============================================================

async function loadStudentProfile() {

    currentUser =
        await getCurrentUser();

    if (!currentUser) {

        showLoggedOutState();

        return;
    }

    console.log(
        "✅ Logged-in user:",
        currentUser.email
    );

    try {

        const {
            data: student,
            error
        } = await supabase
            .from("students")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) {

            console.error(
                "❌ Could not load student profile:",
                error
            );

            showIncompleteProfile(
                currentUser
            );

        } else {

            currentStudent =
                student;

            if (!student) {

                console.warn(
                    "⚠️ No student profile found."
                );

                showIncompleteProfile(
                    currentUser
                );

            } else {

                displayStudentIdentity(
                    student,
                    currentUser
                );
            }
        }

    } catch (error) {

        console.error(
            "❌ Unexpected student profile error:",
            error
        );

        showIncompleteProfile(
            currentUser
        );
    }

    // ========================================================
    // DASHBOARD SYSTEMS
    // ========================================================

    updateDashboardAnalytics();

    setupDashboardNavigation();

    setupAIQuestions();

    updateLearningStreak();

    renderRecentActivity();

}

// ============================================================
// DISPLAY STUDENT IDENTITY
// ============================================================

function displayStudentIdentity(
    student,
    user
) {

    const name =
        student.full_name ||
        "Student";

    const email =
        student.email ||
        user.email ||
        "";

    const course =
        student.course ||
        "Medical Student";

    const level =
        student.level ||
        "";

    const photo =
        student.photo_url ||
        "";

    // --------------------------------------------------------
    // TOP PROFILE BUTTON
    // --------------------------------------------------------

    const profileButton =
        document.querySelector(
            ".profile"
        );

    if (profileButton) {

        profileButton.innerHTML =
            "";

        if (photo) {

            const image =
                document.createElement(
                    "img"
                );

            image.src =
                photo;

            image.alt =
                "Profile photo";

            image.style.cssText = `
                width:34px;
                height:34px;
                border-radius:50%;
                object-fit:cover;
                margin-right:8px;
            `;

            profileButton.appendChild(
                image
            );
        }

        const nameElement =
            document.createElement(
                "span"
            );

        nameElement.textContent =
            name;

        profileButton.appendChild(
            nameElement
        );

        profileButton.onclick =
            () => {

                window.location.href =
                    "studentProfile.html";

            };
    }

    // --------------------------------------------------------
    // HERO
    // --------------------------------------------------------

    const hero =
        document.getElementById(
            "studentPersonalProfile"
        );

    if (!hero) {

        return;
    }

    const greeting =
        getGreeting();

    hero.innerHTML = `
        <div class="hero-content">

            ${
                photo
                ?
                `
                <img
                    src="${escapeHTML(photo)}"
                    class="hero-photo"
                    alt="Student profile photo"
                >
                `
                :
                `
                <div class="hero-avatar">
                    👤
                </div>
                `
            }

            <div class="hero-info">

                <div class="hero-greeting">
                    ${greeting}
                </div>

                <h1 class="hero-name">
                    ${escapeHTML(name)}
                </h1>

                <div class="hero-meta">

                    <span>
                        🎓 ${escapeHTML(course)}
                    </span>

                    ${
                        level
                        ?
                        `
                        <span>
                            📚 ${escapeHTML(level)}
                        </span>
                        `
                        :
                        ""
                    }

                    <span>
                        📧 ${escapeHTML(email)}
                    </span>

                </div>

            </div>

            <div class="hero-actions">

                <button
                    class="hero-profile-button"
                    id="heroProfileButton"
                    type="button"
                >
                    👤 My Profile
                </button>

            </div>

        </div>
    `;

    const heroButton =
        document.getElementById(
            "heroProfileButton"
        );

    if (heroButton) {

        heroButton.onclick =
            () => {

                window.location.href =
                    "studentProfile.html";

            };
    }
}

// ============================================================
// INCOMPLETE PROFILE
// ============================================================

function showIncompleteProfile(
    user
) {

    const hero =
        document.getElementById(
            "studentPersonalProfile"
        );

    if (!hero) {

        return;
    }

    hero.innerHTML = `

        <div class="hero-content">

            <div class="hero-avatar">
                👤
            </div>

            <div class="hero-info">

                <div class="hero-greeting">
                    ${getGreeting()}
                </div>

                <h1 class="hero-name">
                    Student
                </h1>

                <div class="hero-meta">

                    <span>
                        📧 ${escapeHTML(
                            user.email || ""
                        )}
                    </span>

                    <span>
                        Complete your profile
                        for a personalized dashboard.
                    </span>

                </div>

            </div>

            <div class="hero-actions">

                <button
                    class="hero-profile-button"
                    id="completeProfileButton"
                    type="button"
                >
                    👤 Complete Profile
                </button>

            </div>

        </div>
    `;

    const button =
        document.getElementById(
            "completeProfileButton"
        );

    if (button) {

        button.onclick =
            () => {

                window.location.href =
                    "studentProfile.html";

            };
    }
}

// ============================================================
// LOGGED OUT
// ============================================================

function showLoggedOutState() {

    const hero =
        document.getElementById(
            "studentPersonalProfile"
        );

    if (hero) {

        hero.innerHTML = `

            <div class="hero-content">

                <div class="hero-avatar">
                    🔐
                </div>

                <div class="hero-info">

                    <div class="hero-greeting">
                        Welcome to Mwaniki Scholars
                    </div>

                    <h1 class="hero-name">
                        Student Dashboard
                    </h1>

                    <div class="hero-meta">
                        Please log in to view
                        your personalized learning data.
                    </div>

                </div>

            </div>

        `;
    }
}

// ============================================================
// GREETING
// ============================================================

function getGreeting() {

    const hour =
        new Date().getHours();

    if (hour < 12) {

        return "Good morning,";

    }

    if (hour < 17) {

        return "Good afternoon,";

    }

    return "Good evening,";
}

// ============================================================
// RECENT ACTIVITY
// ============================================================

function getRecentActivity() {

    try {

        const raw =
            localStorage.getItem(
                STORAGE.recent
            );

        if (!raw) {

            return [];
        }

        const data =
            JSON.parse(raw);

        return Array.isArray(data)
            ? data
            : [];

    } catch {

        return [];
    }
}

// ============================================================
// SAVE ACTIVITY
// ============================================================

function saveRecentActivity(
    activity
) {

    const current =
        getRecentActivity();

    const filtered =
        current.filter(
            item =>
                !(
                    String(item.courseId) ===
                    String(activity.courseId)
                    &&
                    String(item.unitId) ===
                    String(activity.unitId)
                )
        );

    filtered.unshift({

        ...activity,

        timestamp:
            new Date().toISOString()

    });

    const limited =
        filtered.slice(0, 8);

    localStorage.setItem(
        STORAGE.recent,
        JSON.stringify(limited)
    );

    renderRecentActivity();

    updateDashboardAnalytics();
}

// ============================================================
// RENDER RECENT ACTIVITY
// ============================================================

function renderRecentActivity() {

    const area =
        document.getElementById(
            "recentlyStudied"
        );

    if (!area) {

        return;
    }

    const activities =
        getRecentActivity();

    if (!activities.length) {

        area.innerHTML = `

            <div class="empty-state">

                <span>📚</span>

                <p>
                    No recently studied units yet.
                </p>

            </div>

        `;

        return;
    }

    area.innerHTML =
        activities
            .map(
                activity => {

                    const date =
                        activity.timestamp
                        ?
                        new Date(
                            activity.timestamp
                        ).toLocaleDateString(
                            undefined,
                            {
                                month: "short",
                                day: "numeric"
                            }
                        )
                        :
                        "";

                    return `

                        <div
                            class="recent-item"
                            data-course-id="${escapeHTML(
                                activity.courseId || ""
                            )}"
                            data-unit-id="${escapeHTML(
                                activity.unitId || ""
                            )}"
                        >

                            <div class="recent-icon">
                                📖
                            </div>

                            <div class="recent-details">

                                <strong>
                                    ${escapeHTML(
                                        activity.unitTitle ||
                                        "Study Unit"
                                    )}
                                </strong>

                                <small>
                                    ${escapeHTML(
                                        activity.courseName ||
                                        "Medical Course"
                                    )}
                                    ${
                                        date
                                            ? ` • ${date}`
                                            : ""
                                    }
                                </small>

                            </div>

                        </div>

                    `;

                }
            )
            .join("");
}

// ============================================================
// GLOBAL ACTIVITY HELPER
// Other scripts can call this.
// ============================================================

window.mwanikiTrackUnit =
function (
    courseId,
    courseName,
    unitId,
    unitTitle
) {

    saveRecentActivity({

        courseId,
        courseName,
        unitId,
        unitTitle

    });

};

// ============================================================
// ============================================================
// NOTES LIBRARY
// ============================================================
// THIS IS THE IMPORTANT FIX
// ============================================================
// ============================================================

async function loadNotesLibrary() {

    const notesArea =
        document.getElementById(
            "notesArea"
        );

    if (!notesArea) {

        console.log(
            "ℹ️ notesArea not found. Notes loader skipped."
        );

        return;
    }

    console.log(
        "📚 Starting Notes Library..."
    );

    // --------------------------------------------------------
    // SHOW LOADING
    // --------------------------------------------------------

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
            "📚 Querying Supabase notes table..."
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

        // ----------------------------------------------------
        // SUPABASE ERROR
        // ----------------------------------------------------

        if (error) {

            console.error(
                "❌ NOTES SUPABASE ERROR:",
                error
            );

            allNotes = [];

            renderNotesError(
                notesArea,
                error.message
            );

            return;
        }

        // ----------------------------------------------------
        // DATA SUCCESS
        // ----------------------------------------------------

        allNotes =
            Array.isArray(data)
                ? data
                : [];

        console.log(
            "📚 Notes returned:",
            allNotes.length
        );

        console.log(
            "📚 Notes data:",
            allNotes
        );

        // ----------------------------------------------------
        // EMPTY TABLE / RLS FILTER
        // ----------------------------------------------------

        if (!allNotes.length) {

            notesArea.innerHTML = `

                <div class="notes-empty-card">

                    <div class="notes-empty-icon">
                        📚
                    </div>

                    <h3>
                        No published notes yet
                    </h3>

                    <p>
                        Notes uploaded and published
                        by the administrator will
                        appear here.
                    </p>

                </div>

            `;

            return;
        }

        // ----------------------------------------------------
        // RENDER
        // ----------------------------------------------------

        renderNotes(
            allNotes
        );

        // ----------------------------------------------------
        // SEARCH
        // ----------------------------------------------------

        setupNotesSearch();

        console.log(
            `✅ ${allNotes.length} notes displayed`
        );

    } catch (error) {

        console.error(
            "❌ Unexpected Notes Library error:",
            error
        );

        allNotes = [];

        renderNotesError(
            notesArea,
            error?.message ||
            "Unexpected error while loading notes."
        );
    }
}

// ============================================================
// NOTES ERROR DISPLAY
// ============================================================

function renderNotesError(
    notesArea,
    message
) {

    notesArea.innerHTML = `

        <div class="notes-error-card">

            <div class="notes-error-icon">
                ⚠️
            </div>

            <h3>
                Unable to load notes
            </h3>

            <p>
                ${escapeHTML(
                    message ||
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
            () => {

                loadNotesLibrary();

            }
        );
    }
}

// ============================================================
// RENDER NOTES
// ============================================================

function renderNotes(
    notes
) {

    const notesArea =
        document.getElementById(
            "notesArea"
        );

    if (!notesArea) {

        return;
    }

    if (
        !Array.isArray(notes) ||
        notes.length === 0
    ) {

        notesArea.innerHTML = `

            <div class="notes-empty-card">

                <div class="notes-empty-icon">
                    🔎
                </div>

                <h3>
                    No notes found
                </h3>

                <p>
                    Try a different search term.
                </p>

            </div>

        `;

        return;
    }

    notesArea.innerHTML = `

        <div class="notes-library-grid">

            ${
                notes
                    .map(
                        note => {

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

                            let date =
                                "";

                            if (
                                note.created_at
                            ) {

                                try {

                                    date =
                                        new Date(
                                            note.created_at
                                        ).toLocaleDateString(
                                            undefined,
                                            {
                                                year:
                                                    "numeric",
                                                month:
                                                    "short",
                                                day:
                                                    "numeric"
                                            }
                                        );

                                } catch {

                                    date = "";
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
                                            ${escapeHTML(
                                                fileName
                                            )}
                                        </h3>

                                        <p class="note-course">
                                            📚
                                            ${escapeHTML(
                                                course
                                            )}
                                        </p>

                                        <p class="note-unit">
                                            📖
                                            ${escapeHTML(
                                                unit
                                            )}
                                        </p>

                                        ${
                                            date
                                                ?
                                                `
                                                <small
                                                    class="note-date"
                                                >
                                                    Added
                                                    ${escapeHTML(
                                                        date
                                                    )}
                                                </small>
                                                `
                                                :
                                                ""
                                        }

                                        ${
                                            fileUrl
                                                ?
                                                `
                                                <a
                                                    class="open-note-button"
                                                    href="${escapeHTML(
                                                        fileUrl
                                                    )}"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    📖 Open Notes
                                                </a>
                                                `
                                                :
                                                `
                                                <span
                                                    class="note-unavailable"
                                                >
                                                    ⚠️
                                                    File unavailable
                                                </span>
                                                `
                                        }

                                    </div>

                                </article>

                            `;

                        }
                    )
                    .join("")
            }

        </div>

    `;
}

// ============================================================
// NOTES SEARCH
// ============================================================

function setupNotesSearch() {

    const search =
        document.getElementById(
            "notesSearch"
        );

    if (!search) {

        console.log(
            "ℹ️ notesSearch input not found."
        );

        return;
    }

    if (notesSearchReady) {

        return;
    }

    notesSearchReady =
        true;

    search.addEventListener(
        "input",
        function () {

            const term =
                this.value
                    .toLowerCase()
                    .trim();

            const filtered =
                allNotes.filter(
                    note => {

                        const searchableText = [

                            note.file_name,

                            note.course,

                            note.unit

                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();

                        return searchableText
                            .includes(term);

                    }
                );

            renderNotes(
                filtered
            );

        }
    );
}

// ============================================================
// DASHBOARD ANALYTICS
// ============================================================

function updateDashboardAnalytics() {

    const recent =
        getRecentActivity();

    const quizHistory =
        getQuizHistory();

    // --------------------------------------------------------
    // QUIZZES
    // --------------------------------------------------------

    const quizCount =
        quizHistory.length;

    setText(
        "quizzesAttempted",
        quizCount
    );

    // --------------------------------------------------------
    // AVERAGE SCORE
    // --------------------------------------------------------

    if (
        quizHistory.length
    ) {

        const scores =
            quizHistory
                .map(
                    item =>
                        Number(
                            item.percentage ??
                            item.score ??
                            0
                        )
                )
                .filter(
                    Number.isFinite
                );

        if (scores.length) {

            const average =
                Math.round(
                    scores.reduce(
                        (
                            total,
                            value
                        ) =>
                            total + value,
                        0
                    )
                    /
                    scores.length
                );

            setText(
                "averageScore",
                `${average}%`
            );
        }
    }

    // --------------------------------------------------------
    // UNITS
    // --------------------------------------------------------

    const uniqueUnits =
        new Set(
            recent
                .map(
                    item =>
                        String(
                            item.unitId ??
                            item.unitTitle ??
                            ""
                        )
                )
                .filter(Boolean)
        );

    setText(
        "unitsCompleted",
        uniqueUnits.size
    );

    // --------------------------------------------------------
    // COURSES
    // --------------------------------------------------------

    const courseIds =
        new Set(
            recent
                .map(
                    item =>
                        String(
                            item.courseId ??
                            item.courseName ??
                            ""
                        )
                )
                .filter(Boolean)
        );

    setText(
        "coursesCompleted",
        calculateCompletedCourses(
            courseIds,
            recent
        )
    );

    // --------------------------------------------------------
    // PROGRESS
    // --------------------------------------------------------

    const progress =
        calculateOverallProgress(
            recent
        );

    setText(
        "overallProgressText",
        `${progress}%`
    );

    const progressBar =
        document.getElementById(
            "overallProgressBar"
        );

    if (progressBar) {

        progressBar.style.width =
            `${progress}%`;
    }

    setText(
        "progress",
        `${progress}%`
    );

    // --------------------------------------------------------
    // QUIZ ANALYTICS
    // --------------------------------------------------------

    updateQuizAnalytics(
        quizHistory
    );

    updateAchievements(
        progress,
        quizHistory
    );

    updateContinueLearning(
        recent
    );

    updateRecommendation(
        recent
    );
}

// ============================================================
// QUIZ HISTORY
// ============================================================

function getQuizHistory() {

    try {

        const raw =
            localStorage.getItem(
                STORAGE.quizHistory
            );

        if (!raw) {

            return [];
        }

        const parsed =
            JSON.parse(raw);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch {

        return [];
    }
}

// ============================================================
// CALCULATE COURSES
// ============================================================

function calculateCompletedCourses(
    courseIds,
    recent
) {

    const completed =
        recent.filter(
            item =>
                item.courseCompleted === true
        );

    const completedIds =
        new Set(
            completed
                .map(
                    item =>
                        String(
                            item.courseId ||
                            item.courseName ||
                            ""
                        )
                )
                .filter(Boolean)
        );

    return completedIds.size;
}

// ============================================================
// OVERALL PROGRESS
// ============================================================

function calculateOverallProgress(
    recent
) {

    if (!recent.length) {

        return 0;
    }

    const completed =
        recent.filter(
            item =>
                item.completed === true ||
                item.unitCompleted === true
        );

    if (completed.length) {

        return Math.min(
            100,
            Math.round(
                (
                    completed.length /
                    Math.max(
                        recent.length,
                        1
                    )
                )
                * 100
            )
        );
    }

    return Math.min(
        95,
        Math.max(
            5,
            recent.length * 5
        )
    );
}

// ============================================================
// CONTINUE LEARNING
// ============================================================

function updateContinueLearning(
    recent
) {

    const area =
        document.getElementById(
            "continueLearningContent"
        );

    if (!area) {

        return;
    }

    if (!recent.length) {

        return;
    }

    const item =
        recent[0];

    area.innerHTML = `

        <div class="continue-item">

            <div class="continue-icon">
                ▶
            </div>

            <div class="continue-details">

                <strong>
                    ${escapeHTML(
                        item.unitTitle ||
                        "Continue your studies"
                    )}
                </strong>

                <span>
                    ${escapeHTML(
                        item.courseName ||
                        "Medical Course"
                    )}
                </span>

            </div>

            <button
                class="continue-button"
                type="button"
                id="continueLearningButton"
            >
                Continue
            </button>

        </div>

    `;

    const button =
        document.getElementById(
            "continueLearningButton"
        );

    if (button) {

        button.onclick =
            () => {

                continueActivity(
                    item
                );

            };
    }
}

// ============================================================
// CONTINUE ACTIVITY
// ============================================================

function continueActivity(
    item
) {

    if (
        item.courseId !== undefined &&
        item.courseId !== null
    ) {

        localStorage.setItem(
            "selectedCourse",
            String(item.courseId)
        );
    }

    if (item.courseName) {

        localStorage.setItem(
            "selectedCourseName",
            item.courseName
        );
    }

    if (
        item.unitId !== undefined &&
        item.unitId !== null
    ) {

        localStorage.setItem(
            "selectedUnit",
            String(item.unitId)
        );
    }

    if (item.unitTitle) {

        localStorage.setItem(
            "selectedUnitTitle",
            item.unitTitle
        );
    }

    if (item.courseId) {

        window.location.href =
            "course.html";
    }
}

// ============================================================
// RECOMMENDED LESSON
// ============================================================

function updateRecommendation(
    recent
) {

    const area =
        document.getElementById(
            "recommendedLesson"
        );

    if (!area) {

        return;
    }

    if (!recent.length) {

        return;
    }

    const latest =
        recent[0];

    area.innerHTML = `

        <div class="recommendation-content">

            <div class="recommendation-icon">
                ✨
            </div>

            <div>

                <strong>
                    Continue with
                    ${escapeHTML(
                        latest.courseName ||
                        "your medical course"
                    )}
                </strong>

                <p>
                    Review the next available unit
                    after
                    ${escapeHTML(
                        latest.unitTitle ||
                        "your last lesson"
                    )}.
                </p>

            </div>

        </div>

    `;
}

// ============================================================
// QUIZ ANALYTICS
// ============================================================

function updateQuizAnalytics(
    history
) {

    const recent =
        history.slice(
            0,
            5
        );

    const scores =
        history
            .map(
                item =>
                    Number(
                        item.percentage ??
                        item.score ??
                        0
                    )
            )
            .filter(
                Number.isFinite
            );

    const recentElement =
        document.getElementById(
            "recentQuizPerformance"
        );

    if (
        recentElement &&
        recent.length
    ) {

        const recentScores =
            recent
                .map(
                    item =>
                        Number(
                            item.percentage ??
                            item.score ??
                            0
                        )
                );

        const recentAverage =
            Math.round(
                recentScores.reduce(
                    (
                        a,
                        b
                    ) =>
                        a + b,
                    0
                )
                /
                recentScores.length
            );

        recentElement.textContent =
            `${recentAverage}%`;
    }

    const best =
        scores.length
            ?
            Math.max(
                ...scores
            )
            :
            null;

    setText(
        "bestQuizScore",
        best === null
            ? "—"
            : `${best}%`
    );

    const weak =
        history
            .filter(
                item =>
                    Number(
                        item.percentage ??
                        item.score ??
                        100
                    ) < 60
            )
            .map(
                item =>
                    item.unitTitle ||
                    item.courseName
            )
            .filter(Boolean);

    const uniqueWeak =
        [
            ...new Set(
                weak
            )
        ];

    setText(
        "weakQuizAreas",
        uniqueWeak.length
            ?
            uniqueWeak
                .slice(0, 2)
                .join(", ")
            :
            "None yet"
    );
}

// ============================================================
// ACHIEVEMENTS
// ============================================================

function updateAchievements(
    progress,
    quizHistory
) {

    const achievements =
        document.querySelectorAll(
            ".achievement"
        );

    if (!achievements.length) {

        return;
    }

    if (progress > 0) {

        achievements[0]
            ?.classList.remove(
                "locked"
            );
    }

    if (quizHistory.length >= 10) {

        achievements[1]
            ?.classList.remove(
                "locked"
            );
    }

    const streak =
        Number(
            localStorage.getItem(
                STORAGE.streak
            )
        ) || 0;

    if (streak >= 7) {

        achievements[2]
            ?.classList.remove(
                "locked"
            );
    }

    if (
        progress >= 80 ||
        quizHistory.length >= 25
    ) {

        achievements[3]
            ?.classList.remove(
                "locked"
            );
    }
}

// ============================================================
// LEARNING STREAK
// ============================================================

function updateLearningStreak() {

    const today =
        getDateKey(
            new Date()
        );

    const stored =
        localStorage.getItem(
            STORAGE.lastActivity
        );

    let streak =
        Number(
            localStorage.getItem(
                STORAGE.streak
            )
        ) || 0;

    if (!stored) {

        streak = 1;

    } else {

        const yesterday =
            getDateKey(
                new Date(
                    Date.now() -
                    86400000
                )
            );

        if (
            stored === today
        ) {

            // Same day.

        } else if (
            stored === yesterday
        ) {

            streak += 1;

        } else {

            streak = 1;
        }
    }

    localStorage.setItem(
        STORAGE.lastActivity,
        today
    );

    localStorage.setItem(
        STORAGE.streak,
        String(streak)
    );

    setText(
        "learningStreak",
        `${streak} day${streak === 1 ? "" : "s"}`
    );
}

// ============================================================
// DATE KEY
// ============================================================

function getDateKey(
    date
) {

    return [
        date.getFullYear(),

        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        ),

        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        )

    ].join("-");
}

// ============================================================
// AI SUGGESTIONS
// ============================================================

function setupAIQuestions() {

    const buttons =
        document.querySelectorAll(
            ".suggestion-button"
        );

    const textarea =
        document.getElementById(
            "aiQuestion"
        );

    if (!textarea) {

        return;
    }

    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const question =
                        button.dataset.question ||
                        button.textContent.trim();

                    textarea.value =
                        question;

                    textarea.focus();

                }
            );

        }
    );
}

// ============================================================
// NAVIGATION
// ============================================================

function setupDashboardNavigation() {

    const navLinks =
        document.querySelectorAll(
            ".nav-link"
        );

    navLinks.forEach(
        link => {

            link.addEventListener(
                "click",
                () => {

                    navLinks.forEach(
                        item =>
                            item.classList.remove(
                                "active"
                            )
                    );

                    link.classList.add(
                        "active"
                    );

                }
            );

        }
    );

    const mobileLinks =
        document.querySelectorAll(
            ".mobile-nav-link"
        );

    mobileLinks.forEach(
        link => {

            link.addEventListener(
                "click",
                () => {

                    mobileLinks.forEach(
                        item =>
                            item.classList.remove(
                                "active"
                            )
                    );

                    link.classList.add(
                        "active"
                    );

                }
            );

        }
    );

    const sections =
        document.querySelectorAll(
            ".dashboard-section, .dashboard-home"
        );

    if (!sections.length) {

        return;
    }

    const observer =
        new IntersectionObserver(
            entries => {

                entries.forEach(
                    entry => {

                        if (
                            !entry.isIntersecting
                        ) {

                            return;
                        }

                        const id =
                            entry.target.id;

                        document
                            .querySelectorAll(
                                `.nav-link[data-section="${id}"]`
                            )
                            .forEach(
                                link => {

                                    document
                                        .querySelectorAll(
                                            ".nav-link"
                                        )
                                        .forEach(
                                            item =>
                                                item.classList.remove(
                                                    "active"
                                                )
                                        );

                                    link.classList.add(
                                        "active"
                                    );

                                }
                            );

                    }
                );

            },
            {
                threshold: 0.25
            }
        );

    sections.forEach(
        section =>
            observer.observe(
                section
            )
    );
}

// ============================================================
// CLEAR RECENT ACTIVITY
// ============================================================

const clearButton =
    document.getElementById(
        "clearRecentActivity"
    );

if (clearButton) {

    clearButton.addEventListener(
        "click",
        () => {

            localStorage.removeItem(
                STORAGE.recent
            );

            renderRecentActivity();

            updateDashboardAnalytics();

        }
    );
}

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================

function updateNotifications() {

    const badge =
        document.getElementById(
            "notificationBadge"
        );

    if (!badge) {

        return;
    }

    const notifications =
        Number(
            localStorage.getItem(
                "mwanikiNotificationCount"
            )
        ) || 0;

    if (notifications > 0) {

        badge.textContent =
            notifications;

        badge.style.display =
            "flex";

    } else {

        badge.style.display =
            "none";
    }
}

// ============================================================
// NOTIFICATION BUTTON
// ============================================================

const notificationButton =
    document.getElementById(
        "notificationButton"
    );

if (notificationButton) {

    notificationButton.addEventListener(
        "click",
        () => {

            const badge =
                document.getElementById(
                    "notificationBadge"
                );

            if (badge) {

                badge.style.display =
                    "none";
            }

            localStorage.setItem(
                "mwanikiNotificationCount",
                "0"
            );

            alert(
                "Your Mwaniki Scholars notifications will appear here."
            );

        }
    );
}

// ============================================================
// UTILITY
// ============================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );

    if (element) {

        element.textContent =
            value;
    }
}

// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

// ============================================================
// INITIALIZATION
// ============================================================

async function initializeDashboard() {

    console.log(
        "🚀 Initializing Mwaniki Scholars dashboard..."
    );

    // ========================================================
    // IMPORTANT:
    // NOTES LOAD INDEPENDENTLY FROM STUDENT PROFILE
    // ========================================================

    await loadNotesLibrary();

    // ========================================================
    // PROFILE + DASHBOARD
    // ========================================================

    await loadStudentProfile();

    // ========================================================
    // NOTIFICATIONS
    // ========================================================

    updateNotifications();

    console.log(
        "✅ Mwaniki Scholars dashboard initialized"
    );
}

// ============================================================
// EXPOSE DASHBOARD FUNCTIONS
// ============================================================

window.mwanikiDashboard = {

    refresh:
        updateDashboardAnalytics,

    trackUnit:
        window.mwanikiTrackUnit,

    saveActivity:
        saveRecentActivity,

    reloadNotes:
        loadNotesLibrary

};

// ============================================================
// START
// ============================================================

initializeDashboard();
