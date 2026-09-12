import { supabase } from "./supabase.js";

console.log("🚀 Mwaniki Scholars Dashboard JS loaded");


// =====================================================
// STORAGE KEYS
// =====================================================

const STORAGE_KEYS = {
    selectedCourse: "selectedCourse",
    selectedCourseName: "selectedCourseName",
    selectedUnit: "selectedUnit",
    selectedUnitTitle: "selectedUnitTitle",
    quizProgress: "mwanikiQuizProgress",
    currentUser: "mwanikiCurrentUser"
};


// =====================================================
// GLOBAL STATE
// =====================================================

let currentUser = null;
let studentProfile = null;

let allNotes = [];


// =====================================================
// SAFE HTML ESCAPING
// =====================================================

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


// =====================================================
// STORAGE
// =====================================================

function readStorage(key, fallback = null) {

    try {

        const value = localStorage.getItem(key);

        if (value === null) {
            return fallback;
        }

        try {
            return JSON.parse(value);
        } catch {
            return value;
        }

    } catch (error) {

        console.error(
            `❌ Could not read localStorage key "${key}":`,
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
        } = await supabase.auth.getUser();

        if (error) {
            console.error(
                "❌ Failed to get Supabase user:",
                error
            );

            return null;
        }

        return data?.user || null;

    } catch (error) {

        console.error(
            "❌ getCurrentUser failed:",
            error
        );

        return null;
    }
}


// =====================================================
// STUDENT PROFILE
// =====================================================

async function loadStudentProfile() {

    console.log("👤 Loading student profile...");

    currentUser = await getCurrentUser();

    if (!currentUser) {

        console.log(
            "ℹ️ No authenticated Supabase user found."
        );

        const storedUser =
            readStorage(
                STORAGE_KEYS.currentUser
            );

        if (storedUser) {
            currentUser = storedUser;
        }
    }


    const studentName =
        document.getElementById("studentName");


    if (!currentUser) {

        if (studentName) {
            studentName.textContent = "Student";
        }

        return;
    }


    let displayName =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        currentUser.email?.split("@")[0] ||
        "Student";


    studentProfile = {
        id: currentUser.id,
        email: currentUser.email,
        name: displayName
    };


    if (studentName) {
        studentName.textContent =
            displayName;
    }


    console.log(
        "✅ Student profile loaded:",
        studentProfile
    );
}


// =====================================================
// LOAD DASHBOARD ANALYTICS
// =====================================================

async function loadDashboardAnalytics() {

    console.log(
        "📊 Loading dashboard analytics..."
    );


    try {

        const {
            count: courseCount,
            error: courseError
        } = await supabase
            .from("courses")
            .select("*", {
                count: "exact",
                head: true
            });


        if (!courseError) {

            const totalCourses =
                document.getElementById(
                    "totalCourses"
                );

            if (totalCourses) {
                totalCourses.textContent =
                    courseCount || 0;
            }
        }


        const quizProgress =
            readStorage(
                STORAGE_KEYS.quizProgress,
                {}
            );


        let completedQuizzes = 0;
        let totalScore = 0;


        if (
            quizProgress &&
            typeof quizProgress === "object"
        ) {

            Object.values(
                quizProgress
            ).forEach(progress => {

                if (
                    progress &&
                    typeof progress === "object"
                ) {

                    if (
                        progress.completed ||
                        progress.score !== undefined
                    ) {

                        completedQuizzes++;

                        const score =
                            Number(
                                progress.score
                            );

                        if (
                            Number.isFinite(score)
                        ) {
                            totalScore += score;
                        }
                    }
                }
            });
        }


        const totalQuizzes =
            document.getElementById(
                "totalQuizzes"
            );

        if (totalQuizzes) {
            totalQuizzes.textContent =
                completedQuizzes;
        }


        const averageScore =
            document.getElementById(
                "averageScore"
            );


        if (averageScore) {

            const average =
                completedQuizzes > 0
                    ? Math.round(
                        totalScore /
                        completedQuizzes
                    )
                    : 0;

            averageScore.textContent =
                `${average}%`;
        }


        updateStudyStreak();

    } catch (error) {

        console.error(
            "❌ Dashboard analytics failed:",
            error
        );
    }
}


// =====================================================
// STUDY STREAK
// =====================================================

function updateStudyStreak() {

    const streakElement =
        document.getElementById(
            "studyStreak"
        );

    if (!streakElement) {
        return;
    }


    const storedStreak =
        readStorage(
            "mwanikiStudyStreak",
            0
        );


    streakElement.textContent =
        Number(storedStreak) || 0;
}


// =====================================================
// CONTINUE LEARNING
// =====================================================

function updateContinueLearning() {

    const area =
        document.getElementById(
            "continueLearningContent"
        );


    if (!area) {
        console.log(
            "ℹ️ Continue Learning area not found."
        );
        return;
    }


    const courseId =
        readStorage(
            STORAGE_KEYS.selectedCourse
        );

    const courseName =
        readStorage(
            STORAGE_KEYS.selectedCourseName
        );


    if (!courseId && !courseName) {

        area.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    📖
                </div>

                <h4>
                    Start your learning journey
                </h4>

                <p>
                    Choose a course to begin studying.
                </p>

                <button
                    class="primary-button"
                    type="button"
                    data-section="courses"
                >
                    Browse Courses
                </button>

            </div>
        `;

        return;
    }


    area.innerHTML = `
        <div class="continue-learning-card">

            <div class="continue-icon">
                📚
            </div>

            <div class="continue-content">

                <span>
                    Continue Course
                </span>

                <h4>
                    ${escapeHTML(
                        courseName ||
                        "Your selected course"
                    )}
                </h4>

                <p>
                    Continue where you left off.
                </p>

            </div>

            <button
                class="primary-button"
                type="button"
                id="continueCourseButton"
            >
                Continue →
            </button>

        </div>
    `;


    const continueButton =
        document.getElementById(
            "continueCourseButton"
        );


    if (continueButton) {

        continueButton.addEventListener(
            "click",
            () => {

                if (courseId) {

                    localStorage.setItem(
                        STORAGE_KEYS.selectedCourse,
                        String(courseId)
                    );
                }


                if (courseName) {

                    localStorage.setItem(
                        STORAGE_KEYS.selectedCourseName,
                        String(courseName)
                    );
                }


                window.location.href =
                    "./course.html";
            }
        );
    }
}


// =====================================================
// RECOMMENDED LESSON
// =====================================================

function updateRecommendedLesson() {

    const area =
        document.getElementById(
            "recommendedLesson"
        );


    if (!area) {
        return;
    }


    area.innerHTML = `
        <div class="recommendation-card">

            <div class="recommendation-icon">
                🧠
            </div>

            <div>

                <span>
                    STUDY RECOMMENDATION
                </span>

                <h4>
                    Review a topic you recently studied
                </h4>

                <p>
                    Consistent revision is one of the best ways to strengthen long-term recall.
                </p>

            </div>

        </div>
    `;
}


// =====================================================
// ACHIEVEMENTS
// =====================================================

function updateAchievements() {

    const area =
        document.getElementById(
            "achievementsArea"
        );


    if (!area) {
        return;
    }


    const achievements = [

        {
            icon: "🎓",
            title: "Medical Scholar",
            text: "Begin your Mwaniki Scholars journey."
        },

        {
            icon: "📚",
            title: "Knowledge Seeker",
            text: "Explore your medical course library."
        },

        {
            icon: "🧠",
            title: "Active Learner",
            text: "Complete quizzes and revise regularly."
        }

    ];


    area.innerHTML =
        achievements.map(
            achievement => `

                <div class="achievement-card">

                    <div class="achievement-icon">
                        ${achievement.icon}
                    </div>

                    <div>

                        <h4>
                            ${escapeHTML(
                                achievement.title
                            )}
                        </h4>

                        <p>
                            ${escapeHTML(
                                achievement.text
                            )}
                        </p>

                    </div>

                </div>

            `
        ).join("");
}


// =====================================================
// NOTES LIBRARY
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


    notesArea.innerHTML = `
        <div class="loading-card">

            <div class="loading-spinner"></div>

            <p>
                Loading notes...
            </p>

        </div>
    `;


    console.log(
        "📚 Notes loader started"
    );


    try {

        console.log(
            "📚 Loading published notes from Supabase..."
        );


        const notesRequest =
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


        const timeoutRequest =
            new Promise(
                (_, reject) => {

                    setTimeout(
                        () => {

                            reject(
                                new Error(
                                    "The Notes Library request timed out. Check Supabase connection and RLS policies."
                                )
                            );

                        },
                        15000
                    );

                }
            );


        const result =
            await Promise.race([
                notesRequest,
                timeoutRequest
            ]);


        const {
            data,
            error
        } = result;


        if (error) {

            console.error(
                "❌ NOTES DATABASE ERROR:",
                error
            );


            allNotes = [];


            notesArea.innerHTML = `

                <div class="error-card">

                    <div class="error-icon">
                        ⚠️
                    </div>

                    <h3>
                        Notes could not be loaded
                    </h3>

                    <p>
                        ${escapeHTML(
                            error.message ||
                            "Supabase returned an error."
                        )}
                    </p>

                    <button
                        id="retryNotesButton"
                        class="primary-button"
                        type="button"
                    >
                        Retry
                    </button>

                </div>

            `;


            setupNotesRetry();

            return;
        }


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


        if (allNotes.length === 0) {

            notesArea.innerHTML = `

                <div class="empty-state">

                    <div class="empty-icon">
                        📝
                    </div>

                    <h3>
                        No published notes yet
                    </h3>

                    <p>
                        Notes published by the administration will appear here.
                    </p>

                </div>

            `;


            return;
        }


        renderNotes(
            allNotes
        );


        setupNotesSearch();


        console.log(
            `✅ ${allNotes.length} notes displayed`
        );

    } catch (error) {

        console.error(
            "❌ NOTES LOADING FAILED:",
            error
        );


        allNotes = [];


        notesArea.innerHTML = `

            <div class="error-card">

                <div class="error-icon">
                    ⚠️
                </div>

                <h3>
                    Notes Library could not load
                </h3>

                <p>
                    ${escapeHTML(
                        error.message ||
                        "An unexpected error occurred."
                    )}
                </p>

                <button
                    id="retryNotesButton"
                    class="primary-button"
                    type="button"
                >
                    Retry
                </button>

            </div>

        `;


        setupNotesRetry();
    }
}


// =====================================================
// NOTES RENDERER
// =====================================================

function renderNotes(notes) {

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

            <div class="empty-state">

                <div class="empty-icon">
                    📝
                </div>

                <h3>
                    No notes found
                </h3>

                <p>
                    Try another search.
                </p>

            </div>

        `;

        return;
    }


    notesArea.innerHTML = `

        <div class="notes-library-grid">

            ${
                notes.map(
                    note => {

                        const fileName =
                            note.file_name ||
                            "Medical Notes";

                        const course =
                            note.course ||
                            "Medical Course";

                        const unit =
                            note.unit ||
                            "General";

                        const fileUrl =
                            note.file_url ||
                            "#";

                        let dateText =
                            "";


                        if (
                            note.created_at
                        ) {

                            try {

                                dateText =
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
                                dateText = "";
                            }
                        }


                        return `

                            <article
                                class="note-card"
                            >

                                <div class="note-card-icon">
                                    📄
                                </div>


                                <div class="note-card-content">

                                    <span class="note-course">
                                        ${escapeHTML(
                                            course
                                        )}
                                    </span>

                                    <h3>
                                        ${escapeHTML(
                                            fileName
                                        )}
                                    </h3>

                                    <p>
                                        ${escapeHTML(
                                            unit
                                        )}
                                    </p>

                                    ${
                                        dateText
                                            ? `
                                                <small>
                                                    ${escapeHTML(
                                                        dateText
                                                    )}
                                                </small>
                                            `
                                            : ""
                                    }

                                </div>


                                <div class="note-card-action">

                                    ${
                                        fileUrl !== "#"
                                            ? `
                                                <a
                                                    href="${escapeHTML(
                                                        fileUrl
                                                    )}"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="primary-button"
                                                >
                                                    Open Notes →
                                                </a>
                                            `
                                            : `
                                                <span class="disabled-button">
                                                    File unavailable
                                                </span>
                                            `
                                    }

                                </div>

                            </article>

                        `;
                    }
                ).join("")
            }

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
        return;
    }


    if (
        search.dataset.listenerAttached ===
        "true"
    ) {
        return;
    }


    search.dataset.listenerAttached =
        "true";


    search.addEventListener(
        "input",
        event => {

            const query =
                event.target.value
                    .trim()
                    .toLowerCase();


            if (!query) {

                renderNotes(
                    allNotes
                );

                return;
            }


            const filtered =
                allNotes.filter(
                    note => {

                        const searchable = [

                            note.file_name,

                            note.course,

                            note.unit

                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();


                        return searchable.includes(
                            query
                        );
                    }
                );


            if (
                filtered.length === 0
            ) {

                const notesArea =
                    document.getElementById(
                        "notesArea"
                    );


                if (notesArea) {

                    notesArea.innerHTML = `

                        <div class="empty-state">

                            <div class="empty-icon">
                                🔎
                            </div>

                            <h3>
                                No matching notes
                            </h3>

                            <p>
                                Try searching for another course, unit, or note title.
                            </p>

                        </div>

                    `;
                }

                return;
            }


            renderNotes(
                filtered
            );

        }
    );
}


// =====================================================
// NOTES RETRY
// =====================================================

function setupNotesRetry() {

    const button =
        document.getElementById(
            "retryNotesButton"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {
            loadNotesLibrary();
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


    function showSection(
        sectionId
    ) {

        console.log(
            "🧭 Opening section:",
            sectionId
        );


        sections.forEach(
            section => {

                section.classList.toggle(
                    "active",
                    section.id === sectionId
                );

            }
        );


        navLinks.forEach(
            link => {

                link.classList.toggle(
                    "active",
                    link.dataset.section === sectionId
                );

            }
        );


        mobileLinks.forEach(
            link => {

                link.classList.toggle(
                    "active",
                    link.dataset.section === sectionId
                );

            }
        );


        if (
            sectionId ===
            "notesLibrary"
        ) {

            if (
                allNotes.length === 0
            ) {

                loadNotesLibrary();

            } else {

                renderNotes(
                    allNotes
                );
            }
        }


        if (
            sectionId ===
            "courses"
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "mwaniki:dashboard:courses"
                )
            );
        }


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }


    navLinks.forEach(
        link => {

            link.addEventListener(
                "click",
                () => {

                    showSection(
                        link.dataset.section
                    );

                }
            );

        }
    );


    mobileLinks.forEach(
        link => {

            link.addEventListener(
                "click",
                () => {

                    showSection(
                        link.dataset.section
                    );

                }
            );

        }
    );


    document.addEventListener(
        "click",
        event => {

            const sectionButton =
                event.target.closest(
                    "[data-section]"
                );


            if (
                !sectionButton ||
                sectionButton.classList.contains(
                    "nav-link"
                ) ||
                sectionButton.classList.contains(
                    "mobile-nav-link"
                )
            ) {
                return;
            }


            showSection(
                sectionButton.dataset.section
            );
        }
    );
}


// =====================================================
// AI QUESTIONS
// =====================================================

function setupAIQuestions() {

    const suggestions =
        document.querySelectorAll(
            ".suggestion-button"
        );


    const questionBox =
        document.getElementById(
            "aiQuestion"
        );


    if (
        !questionBox ||
        !suggestions.length
    ) {
        return;
    }


    suggestions.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    questionBox.value =
                        button.textContent.trim();


                    questionBox.focus();

                }
            );

        }
    );
}


// =====================================================
// HEADER BUTTONS
// =====================================================

function setupHeaderButtons() {

    const profileButton =
        document.getElementById(
            "profileButton"
        );


    const notificationButton =
        document.getElementById(
            "notificationButton"
        );


    if (profileButton) {

        profileButton.addEventListener(
            "click",
            () => {

                window.location.href =
                    "./profile.html";
            }
        );
    }


    if (notificationButton) {

        notificationButton.addEventListener(
            "click",
            () => {

                alert(
                    "You have no new notifications."
                );

            }
        );
    }
}


// =====================================================
// GLOBAL DASHBOARD API
// =====================================================

window.mwanikiDashboard = {

    loadNotesLibrary,

    renderNotes,

    refreshNotes: loadNotesLibrary,

    showSection: sectionId => {

        const button =
            document.querySelector(
                `.nav-link[data-section="${sectionId}"]`
            );


        if (button) {
            button.click();
        }
    }

};


// =====================================================
// INITIALIZATION
// =====================================================

async function initializeDashboard() {

    console.log(
        "🚀 Initializing Mwaniki Scholars dashboard..."
    );


    setupDashboardNavigation();

    setupAIQuestions();

    setupHeaderButtons();


    updateContinueLearning();

    updateRecommendedLesson();

    updateAchievements();


    // Start Notes Library immediately.
    await loadNotesLibrary();


    await loadStudentProfile();


    await loadDashboardAnalytics();


    console.log(
        "✅ Mwaniki Scholars dashboard initialized"
    );
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
        initializeDashboard
    );

} else {

    initializeDashboard();

}
