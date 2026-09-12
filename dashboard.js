import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS
// STUDENT DASHBOARD ENGINE
// =====================================================

console.log("🚀 Mwaniki Scholars dashboard.js loaded");

// =====================================================
// STORAGE KEYS
// =====================================================

const RECENT_ACTIVITY_KEY = "mwanikiRecentActivity";
const QUIZ_PROGRESS_KEY = "mwanikiQuizProgress";
const QUIZ_HISTORY_KEY = "mwanikiQuizHistory";


// =====================================================
// GLOBAL DATA
// =====================================================

let currentUser = null;
let currentProfile = null;

let dashboardCourses = [];
let dashboardNotes = [];
let recentActivity = [];
let quizHistory = [];


// =====================================================
// BASIC HELPERS
// =====================================================

function getElement(id) {
    return document.getElementById(id);
}


function setText(id, value) {
    const element = getElement(id);

    if (element) {
        element.textContent = value ?? "";
    }
}


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


function safeDate(dateValue) {
    if (!dateValue) {
        return "";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString();
}


function safeNumber(value, fallback = 0) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


// =====================================================
// LOCAL STORAGE HELPERS
// =====================================================

function readStorage(key, fallback = []) {
    try {
        const raw = localStorage.getItem(key);

        if (!raw) {
            return fallback;
        }

        const parsed = JSON.parse(raw);

        return parsed ?? fallback;

    } catch (error) {

        console.warn(
            `Could not read localStorage key: ${key}`,
            error
        );

        return fallback;
    }
}


function writeStorage(key, value) {
    try {

        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

    } catch (error) {

        console.warn(
            `Could not write localStorage key: ${key}`,
            error
        );
    }
}


// =====================================================
// SESSION
// =====================================================

async function loadCurrentSession() {

    try {

        const {
            data,
            error
        } = await supabase.auth.getSession();

        if (error) {

            console.error(
                "❌ Could not load session:",
                error
            );

            return null;
        }

        currentUser = data?.session?.user ?? null;

        console.log(
            "👤 Current user:",
            currentUser
        );

        return currentUser;

    } catch (error) {

        console.error(
            "❌ Session error:",
            error
        );

        return null;
    }
}


// =====================================================
// PROFILE
// =====================================================

async function loadStudentProfile() {

    const profileButton =
        getElement("studentProfileButton");

    const hero =
        getElement("studentPersonalProfile");

    if (!currentUser) {

        if (profileButton) {
            profileButton.textContent =
                "👤 Student";
        }

        if (hero) {

            hero.innerHTML = `
                <div class="hero-loading">
                    <div>
                        <strong>
                            Welcome to Mwaniki Scholars
                        </strong>

                        <p>
                            Please sign in to access your
                            personalized learning dashboard.
                        </p>
                    </div>
                </div>
            `;
        }

        return null;
    }


    let profile = null;


    // -------------------------------------------------
    // Try common profile table
    // -------------------------------------------------

    try {

        const {
            data,
            error
        } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (!error && data) {

            profile = data;
        }

    } catch (error) {

        console.warn(
            "Profiles table could not be read:",
            error
        );
    }


    currentProfile = profile;


    const metadata =
        currentUser.user_metadata || {};


    const studentName =
        profile?.full_name ||
        profile?.name ||
        profile?.student_name ||
        metadata.full_name ||
        metadata.name ||
        metadata.student_name ||
        currentUser.email?.split("@")[0] ||
        "Scholar";


    const email =
        profile?.email ||
        currentUser.email ||
        "";


    // -------------------------------------------------
    // Header profile
    // -------------------------------------------------

    if (profileButton) {

        profileButton.textContent =
            `👤 ${studentName}`;

        profileButton.onclick = () => {

            window.location.href =
                "studentProfile.html";
        };
    }


    // -------------------------------------------------
    // Hero
    // -------------------------------------------------

    if (hero) {

        hero.innerHTML = `

            <div class="hero-content">

                <div class="hero-avatar">
                    👨‍⚕️
                </div>

                <div class="hero-text">

                    <span class="eyebrow">
                        WELCOME BACK, SCHOLAR
                    </span>

                    <h1>
                        ${escapeHTML(studentName)}
                    </h1>

                    <p>
                        ${escapeHTML(email)}
                    </p>

                    <p>
                        Continue your medical learning
                        journey with Mwaniki Scholars.
                    </p>

                </div>

            </div>
        `;
    }


    // -------------------------------------------------
    // Tutor form auto-fill
    // -------------------------------------------------

    const studentNameInput =
        getElement("studentName");

    const studentEmailInput =
        getElement("studentEmail");

    const checkEmailInput =
        getElement("checkEmail");


    if (studentNameInput && !studentNameInput.value) {

        studentNameInput.value =
            studentName;
    }


    if (studentEmailInput && !studentEmailInput.value) {

        studentEmailInput.value =
            email;
    }


    if (checkEmailInput && !checkEmailInput.value) {

        checkEmailInput.value =
            email;
    }


    return profile;
}


// =====================================================
// RECENT ACTIVITY
// =====================================================

function loadRecentActivity() {

    recentActivity =
        readStorage(
            RECENT_ACTIVITY_KEY,
            []
        );

    renderRecentActivity();

    updateContinueLearning();

    updateRecommendedLesson();
}


function renderRecentActivity() {

    const container =
        getElement("recentlyStudied");

    if (!container) {
        return;
    }


    if (!Array.isArray(recentActivity) ||
        recentActivity.length === 0) {

        container.innerHTML = `

            <div class="empty-state">

                <span>📚</span>

                <p>
                    No recently studied units yet.
                </p>

            </div>
        `;

        return;
    }


    const limited =
        recentActivity.slice(0, 8);


    container.innerHTML =
        limited.map(item => {

            const courseName =
                item.courseName ||
                "Medical Course";

            const unitTitle =
                item.unitTitle ||
                "Medical Unit";


            return `

                <div class="recent-item">

                    <div class="recent-item-icon">
                        📖
                    </div>

                    <div class="recent-item-content">

                        <strong>
                            ${escapeHTML(unitTitle)}
                        </strong>

                        <span>
                            ${escapeHTML(courseName)}
                        </span>

                        ${
                            item.timestamp
                                ? `
                                    <small>
                                        ${safeDate(
                                            item.timestamp
                                        )}
                                    </small>
                                  `
                                : ""
                        }

                    </div>

                    <button
                        type="button"
                        class="small-action"
                        data-recent-course-id="${escapeHTML(
                            item.courseId ?? ""
                        )}"
                        data-recent-course-name="${escapeHTML(
                            courseName
                        )}"
                        data-recent-unit-id="${escapeHTML(
                            item.unitId ?? ""
                        )}"
                        data-recent-unit-title="${escapeHTML(
                            unitTitle
                        )}"
                    >
                        Continue
                    </button>

                </div>
            `;

        }).join("");


    container
        .querySelectorAll(
            "[data-recent-course-id]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    openUnitFromRecent(button);
                }
            );
        });
}


function openUnitFromRecent(button) {

    const courseId =
        button.dataset.recentCourseId;

    const courseName =
        button.dataset.recentCourseName;

    const unitId =
        button.dataset.recentUnitId;

    const unitTitle =
        button.dataset.recentUnitTitle;


    if (courseId) {

        localStorage.setItem(
            "selectedCourse",
            courseId
        );
    }


    if (courseName) {

        localStorage.setItem(
            "selectedCourseName",
            courseName
        );
    }


    if (unitId) {

        localStorage.setItem(
            "selectedUnit",
            unitId
        );
    }


    if (unitTitle) {

        localStorage.setItem(
            "selectedUnitTitle",
            unitTitle
        );
    }


    window.location.href =
        "course.html";
}


// =====================================================
// CONTINUE LEARNING
// =====================================================

function updateContinueLearning() {

    const container =
        getElement("continueLearningContent");

    if (!container) {
        return;
    }


    const latest =
        recentActivity?.[0];


    if (!latest) {

        container.innerHTML = `

            <div class="empty-learning">

                <div class="empty-icon">
                    📖
                </div>

                <div>

                    <strong>
                        Your learning journey starts here
                    </strong>

                    <p>
                        Open a medical course to begin studying.
                    </p>

                </div>

            </div>
        `;

        return;
    }


    const courseName =
        latest.courseName ||
        "Medical Course";

    const unitTitle =
        latest.unitTitle ||
        "Medical Unit";


    container.innerHTML = `

        <div class="continue-learning-card">

            <div class="continue-icon">
                ▶
            </div>

            <div class="continue-content">

                <span class="eyebrow">
                    CONTINUE STUDYING
                </span>

                <strong>
                    ${escapeHTML(unitTitle)}
                </strong>

                <p>
                    ${escapeHTML(courseName)}
                </p>

            </div>

            <button
                type="button"
                id="continueLearningButton"
                class="primary-button"
            >
                Continue →
            </button>

        </div>
    `;


    const button =
        getElement("continueLearningButton");


    if (button) {

        button.addEventListener(
            "click",
            () => {

                openUnitFromRecent({
                    dataset: {
                        recentCourseId:
                            latest.courseId ?? "",

                        recentCourseName:
                            courseName,

                        recentUnitId:
                            latest.unitId ?? "",

                        recentUnitTitle:
                            unitTitle
                    }
                });

            }
        );
    }
}


// =====================================================
// RECOMMENDED LESSON
// =====================================================

function updateRecommendedLesson() {

    const container =
        getElement("recommendedLesson");

    if (!container) {
        return;
    }


    if (!dashboardCourses.length) {

        container.innerHTML = `

            <div class="recommendation-content">

                <div class="recommendation-icon">
                    🧠
                </div>

                <div>

                    <strong>
                        Explore your courses
                    </strong>

                    <p>
                        Choose a medical course and start
                        building your knowledge.
                    </p>

                </div>

            </div>
        `;

        return;
    }


    const course =
        dashboardCourses[0];


    container.innerHTML = `

        <div class="recommendation-content">

            <div class="recommendation-icon">
                🧠
            </div>

            <div>

                <span class="eyebrow">
                    RECOMMENDED COURSE
                </span>

                <strong>
                    ${escapeHTML(course.title)}
                </strong>

                <p>
                    ${escapeHTML(
                        course.description ||
                        "Start learning this medical course."
                    )}
                </p>

                <button
                    type="button"
                    class="primary-button"
                    id="recommendedCourseButton"
                >
                    Explore Course →
                </button>

            </div>

        </div>
    `;


    const button =
        getElement("recommendedCourseButton");


    if (button) {

        button.addEventListener(
            "click",
            () => {

                openCourse(
                    course.id,
                    course.title
                );
            }
        );
    }
}


// =====================================================
// COURSE LIBRARY
// =====================================================

async function loadCourses() {

    const courseArea =
        getElement("courseArea");


    if (!courseArea) {
        return [];
    }


    courseArea.innerHTML = `

        <div class="loading-card">

            <div class="loading-spinner"></div>

            <p>
                Loading courses...
            </p>

        </div>
    `;


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
            .order(
                "title",
                {
                    ascending: true
                }
            );


        if (error) {

            console.error(
                "❌ Course loading error:",
                error
            );

            courseArea.innerHTML = `

                <div class="error-card">

                    <strong>
                        Unable to load courses
                    </strong>

                    <p>
                        ${escapeHTML(
                            error.message
                        )}
                    </p>

                </div>
            `;

            return [];
        }


        dashboardCourses =
            Array.isArray(data)
                ? data
                : [];


        setText(
            "totalCourses",
            dashboardCourses.length
        );


        renderCourses(
            dashboardCourses
        );


        updateRecommendedLesson();


        return dashboardCourses;

    } catch (error) {

        console.error(
            "❌ Unexpected course error:",
            error
        );


        courseArea.innerHTML = `

            <div class="error-card">

                <strong>
                    Something went wrong
                </strong>

                <p>
                    Please refresh the page.
                </p>

            </div>
        `;


        return [];
    }
}


function renderCourses(courses) {

    const courseArea =
        getElement("courseArea");


    if (!courseArea) {
        return;
    }


    if (!courses.length) {

        courseArea.innerHTML = `

            <div class="empty-state">

                <div>
                    📚
                </div>

                <strong>
                    No courses found
                </strong>

                <p>
                    No medical courses are currently available.
                </p>

            </div>
        `;

        return;
    }


    courseArea.innerHTML =
        courses.map(course => {

            const title =
                course.title ||
                "Untitled Course";

            const description =
                course.description ||
                "Medical learning course";


            return `

                <article
                    class="course-card"
                >

                    ${
                        course.image
                            ? `
                                <img
                                    src="${escapeHTML(
                                        course.image
                                    )}"
                                    alt="${escapeHTML(
                                        title
                                    )}"
                                    class="course-image"
                                    loading="lazy"
                                    onerror="
                                        this.style.display='none'
                                    "
                                >
                              `
                            : `
                                <div class="course-image-placeholder">
                                    🩺
                                </div>
                              `
                    }


                    <div class="course-card-content">

                        <span class="eyebrow">
                            MEDICAL COURSE
                        </span>

                        <h3>
                            ${escapeHTML(title)}
                        </h3>

                        <p>
                            ${escapeHTML(
                                description
                            )}
                        </p>

                        <button
                            type="button"
                            class="primary-button"
                            data-course-id="${escapeHTML(
                                course.id
                            )}"
                            data-course-title="${escapeHTML(
                                title
                            )}"
                        >
                            Open Course →
                        </button>

                    </div>

                </article>
            `;

        }).join("");


    courseArea
        .querySelectorAll(
            "[data-course-id]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    openCourse(
                        button.dataset.courseId,
                        button.dataset.courseTitle
                    );
                }
            );
        });
}


function openCourse(
    courseId,
    courseName
) {

    localStorage.setItem(
        "selectedCourse",
        String(courseId)
    );


    localStorage.setItem(
        "selectedCourseName",
        courseName || ""
    );


    localStorage.removeItem(
        "selectedUnit"
    );


    localStorage.removeItem(
        "selectedUnitTitle"
    );


    window.location.href =
        "course.html";
}


// =====================================================
// COURSE SEARCH
// =====================================================

function setupCourseSearch() {

    const input =
        getElement("courseSearch");


    if (!input) {
        return;
    }


    input.addEventListener(
        "input",
        () => {

            const query =
                input.value
                    .trim()
                    .toLowerCase();


            if (!query) {

                renderCourses(
                    dashboardCourses
                );

                return;
            }


            const filtered =
                dashboardCourses.filter(
                    course => {

                        const title =
                            String(
                                course.title || ""
                            ).toLowerCase();

                        const description =
                            String(
                                course.description || ""
                            ).toLowerCase();


                        return (
                            title.includes(query) ||
                            description.includes(query)
                        );
                    }
                );


            renderCourses(
                filtered
            );
        }
    );
}


// =====================================================
// NOTES LIBRARY
// =====================================================

async function loadNotes() {

    const notesArea =
        getElement("notesArea");


    if (!notesArea) {

        console.warn(
            "⚠️ #notesArea was not found."
        );

        return [];
    }


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
            "📄 Loading published notes from Supabase..."
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


        if (error) {

            console.error(
                "❌ Notes loading error:",
                error
            );


            notesArea.innerHTML = `

                <div class="error-card">

                    <strong>
                        Notes could not be loaded
                    </strong>

                    <p>
                        ${escapeHTML(
                            error.message
                        )}
                    </p>

                    <small>
                        Check the Supabase RLS policy
                        for the public.notes table.
                    </small>

                </div>
            `;

            return [];
        }


        dashboardNotes =
            Array.isArray(data)
                ? data
                : [];


        console.log(
            `📄 ${dashboardNotes.length} published notes loaded.`
        );


        renderNotes(
            dashboardNotes
        );


        return dashboardNotes;

    } catch (error) {

        console.error(
            "❌ Unexpected notes error:",
            error
        );


        notesArea.innerHTML = `

            <div class="error-card">

                <strong>
                    Something went wrong while loading notes.
                </strong>

                <p>
                    Please refresh the dashboard.
                </p>

            </div>
        `;


        return [];
    }
}


// =====================================================
// RENDER NOTES
// =====================================================

function renderNotes(notes) {

    const notesArea =
        getElement("notesArea");


    if (!notesArea) {
        return;
    }


    if (!Array.isArray(notes) ||
        notes.length === 0) {

        notesArea.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    📄
                </div>

                <div>

                    <strong>
                        No published notes yet
                    </strong>

                    <p>
                        Published study materials will
                        appear here.
                    </p>

                </div>

            </div>
        `;

        return;
    }


    notesArea.innerHTML =
        notes.map(note => {

            const fileName =
                note.file_name ||
                "Study Notes";

            const course =
                note.course ||
                "Medical Course";

            const unit =
                note.unit ||
                "General Study Material";


            const fileUrl =
                note.file_url || "";


            return `

                <article
                    class="note-card"
                >

                    <div class="note-icon">
                        📄
                    </div>


                    <div class="note-content">

                        <span class="eyebrow">
                            STUDY MATERIAL
                        </span>

                        <h3>
                            ${escapeHTML(
                                fileName
                            )}
                        </h3>

                        <p>
                            <strong>
                                Course:
                            </strong>

                            ${escapeHTML(
                                course
                            )}
                        </p>

                        <p>
                            <strong>
                                Unit:
                            </strong>

                            ${escapeHTML(
                                unit
                            )}
                        </p>


                        ${
                            note.created_at
                                ? `
                                    <small>
                                        Uploaded:
                                        ${safeDate(
                                            note.created_at
                                        )}
                                    </small>
                                  `
                                : ""
                        }


                        ${
                            fileUrl
                                ? `
                                    <a
                                        class="primary-button note-open-button"
                                        href="${escapeHTML(
                                            fileUrl
                                        )}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        📖 Open Notes
                                    </a>
                                  `
                                : `
                                    <span class="note-unavailable">
                                        File link unavailable
                                    </span>
                                  `
                        }

                    </div>

                </article>
            `;

        }).join("");
}


// =====================================================
// NOTES SEARCH
// =====================================================

function setupNotesSearch() {

    const input =
        getElement("notesSearch");


    if (!input) {
        return;
    }


    input.addEventListener(
        "input",
        () => {

            const query =
                input.value
                    .trim()
                    .toLowerCase();


            if (!query) {

                renderNotes(
                    dashboardNotes
                );

                return;
            }


            const filtered =
                dashboardNotes.filter(
                    note => {

                        const fileName =
                            String(
                                note.file_name || ""
                            ).toLowerCase();

                        const course =
                            String(
                                note.course || ""
                            ).toLowerCase();

                        const unit =
                            String(
                                note.unit || ""
                            ).toLowerCase();


                        return (
                            fileName.includes(query) ||
                            course.includes(query) ||
                            unit.includes(query)
                        );
                    }
                );


            renderNotes(
                filtered
            );
        }
    );
}


// =====================================================
// QUIZ HISTORY
// =====================================================

function loadQuizHistory() {

    quizHistory =
        readStorage(
            QUIZ_HISTORY_KEY,
            []
        );


    if (!Array.isArray(quizHistory)) {

        quizHistory = [];
    }


    updateQuizAnalytics();

    updateLearningProgress();
}


// =====================================================
// QUIZ ANALYTICS
// =====================================================

function updateQuizAnalytics() {

    const attempts =
        quizHistory.filter(
            item =>
                item &&
                (
                    item.score !== undefined ||
                    item.percentage !== undefined
                )
        );


    const quizCount =
        attempts.length;


    setText(
        "quizzesAttempted",
        quizCount
    );


    if (!quizCount) {

        setText(
            "recentQuizPerformance",
            "—"
        );

        setText(
            "bestQuizScore",
            "—"
        );

        setText(
            "averageScore",
            "0%"
        );

        setText(
            "weakQuizAreas",
            "—"
        );

        return;
    }


    const percentages =
        attempts.map(
            item => {

                if (
                    item.percentage !== undefined
                ) {

                    return safeNumber(
                        item.percentage
                    );
                }


                if (
                    item.score !== undefined &&
                    item.total !== undefined &&
                    safeNumber(item.total) > 0
                ) {

                    return (
                        safeNumber(item.score) /
                        safeNumber(item.total)
                    ) * 100;
                }


                return safeNumber(
                    item.score
                );
            }
        );


    const average =
        percentages.reduce(
            (sum, value) =>
                sum + value,
            0
        ) / percentages.length;


    const best =
        Math.max(
            ...percentages
        );


    const recent =
        percentages[0] ?? 0;


    setText(
        "recentQuizPerformance",
        `${Math.round(recent)}%`
    );


    setText(
        "bestQuizScore",
        `${Math.round(best)}%`
    );


    setText(
        "averageScore",
        `${Math.round(average)}%`
    );


    // -------------------------------------------------
    // Weak areas
    // -------------------------------------------------

    const weakMap = {};


    attempts.forEach(
        (item, index) => {

            const percentage =
                percentages[index];


            const unit =
                item.unitTitle ||
                item.unit ||
                item.courseName ||
                item.course ||
                "General";


            if (!weakMap[unit]) {

                weakMap[unit] = [];
            }


            weakMap[unit].push(
                percentage
            );
        }
    );


    const weakAreas =
        Object.entries(weakMap)
            .map(
                ([name, scores]) => {

                    const averageScore =
                        scores.reduce(
                            (sum, score) =>
                                sum + score,
                            0
                        ) / scores.length;


                    return {
                        name,
                        score: averageScore
                    };
                }
            )
            .sort(
                (a, b) =>
                    a.score - b.score
            )
            .slice(0, 2);


    if (!weakAreas.length) {

        setText(
            "weakQuizAreas",
            "—"
        );

    } else {

        setText(
            "weakQuizAreas",
            weakAreas
                .map(
                    item =>
                        `${item.name} (${Math.round(item.score)}%)`
                )
                .join(", ")
        );
    }
}


// =====================================================
// LEARNING PROGRESS
// =====================================================

function updateLearningProgress() {

    const total =
        dashboardCourses.length;


    const attempted =
        quizHistory.length;


    let percentage = 0;


    if (total > 0 && attempted > 0) {

        percentage =
            Math.min(
                100,
                Math.round(
                    (
                        attempted /
                        total
                    ) * 100
                )
            );
    }


    setText(
        "overallProgressText",
        `${percentage}%`
    );


    const progressBar =
        getElement(
            "overallProgressBar"
        );


    if (progressBar) {

        progressBar.style.width =
            `${percentage}%`;
    }


    const progress =
        getElement("progress");


    if (progress) {

        progress.textContent =
            `${percentage}%`;
    }


    setText(
        "unitsCompleted",
        recentActivity.length
    );


    setText(
        "coursesCompleted",
        calculateCompletedCourses()
    );


    updateAchievements(
        percentage
    );
}


function calculateCompletedCourses() {

    if (!recentActivity.length) {
        return 0;
    }


    const completed =
        new Set();


    recentActivity.forEach(
        item => {

            if (
                item.courseId !== undefined &&
                item.courseId !== null
            ) {

                completed.add(
                    String(item.courseId)
                );
            }
        }
    );


    return completed.size;
}


// =====================================================
// ACHIEVEMENTS
// =====================================================

function updateAchievements(
    progressPercentage
) {

    const container =
        getElement(
            "achievementIndicators"
        );


    if (!container) {
        return;
    }


    const achievements =
        container.querySelectorAll(
            ".achievement"
        );


    if (achievements.length >= 1) {

        achievements[0]
            .classList.remove(
                "locked"
            );
    }


    if (achievements.length >= 2) {

        if (
            quizHistory.length >= 10
        ) {

            achievements[1]
                .classList.remove(
                    "locked"
                );

        } else {

            achievements[1]
                .classList.add(
                    "locked"
                );
        }
    }


    if (achievements.length >= 3) {

        const streak =
            calculateLearningStreak();


        if (streak >= 7) {

            achievements[2]
                .classList.remove(
                    "locked"
                );

        } else {

            achievements[2]
                .classList.add(
                    "locked"
                );
        }
    }


    if (achievements.length >= 4) {

        if (
            progressPercentage >= 75
        ) {

            achievements[3]
                .classList.remove(
                    "locked"
                );

        } else {

            achievements[3]
                .classList.add(
                    "locked"
                );
        }
    }
}


// =====================================================
// LEARNING STREAK
// =====================================================

function calculateLearningStreak() {

    if (!recentActivity.length) {

        setText(
            "learningStreak",
            "0 days"
        );

        return 0;
    }


    const dates =
        recentActivity
            .map(
                item => {

                    const date =
                        new Date(
                            item.timestamp
                        );


                    if (
                        Number.isNaN(
                            date.getTime()
                        )
                    ) {

                        return null;
                    }


                    return date
                        .toISOString()
                        .slice(0, 10);
                }
            )
            .filter(Boolean);


    const uniqueDates =
        [...new Set(dates)]
            .sort()
            .reverse();


    if (!uniqueDates.length) {

        setText(
            "learningStreak",
            "0 days"
        );

        return 0;
    }


    const today =
        new Date();


    today.setHours(
        0,
        0,
        0,
        0
    );


    const todayString =
        today
            .toISOString()
            .slice(0, 10);


    let streak = 0;


    let expectedDate =
        new Date(today);


    // Allow the most recent activity to be yesterday.
    const firstDate =
        new Date(
            `${uniqueDates[0]}T00:00:00`
        );


    const difference =
        Math.round(
            (
                expectedDate -
                firstDate
            ) /
            (
                1000 *
                60 *
                60 *
                24
            )
        );


    if (
        difference > 1
    ) {

        setText(
            "learningStreak",
            "0 days"
        );

        return 0;
    }


    if (
        uniqueDates[0] !==
        todayString
    ) {

        expectedDate.setDate(
            expectedDate.getDate() - 1
        );
    }


    for (
        const dateString of uniqueDates
    ) {

        const expectedString =
            expectedDate
                .toISOString()
                .slice(0, 10);


        if (
            dateString !==
            expectedString
        ) {

            break;
        }


        streak++;


        expectedDate.setDate(
            expectedDate.getDate() - 1
        );
    }


    setText(
        "learningStreak",
        `${streak} day${streak === 1 ? "" : "s"}`
    );


    return streak;
}


// =====================================================
// COURSE PROGRESS
// =====================================================

async function loadCourseProgress() {

    const container =
        getElement(
            "courseProgressArea"
        );


    if (!container) {
        return;
    }


    if (!dashboardCourses.length) {

        container.innerHTML = `

            <div class="empty-state">

                <span>
                    📚
                </span>

                <p>
                    Course progress will appear here.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        dashboardCourses
            .slice(0, 12)
            .map(course => {

                const courseId =
                    String(course.id);


                const courseActivities =
                    recentActivity.filter(
                        item =>
                            String(
                                item.courseId
                            ) === courseId
                    );


                const progress =
                    courseActivities.length
                        ? Math.min(
                            100,
                            courseActivities.length * 10
                        )
                        : 0;


                return `

                    <div
                        class="course-progress-item"
                    >

                        <div
                            class="course-progress-header"
                        >

                            <strong>
                                ${escapeHTML(
                                    course.title
                                )}
                            </strong>

                            <span>
                                ${progress}%
                            </span>

                        </div>

                        <div
                            class="progress-track"
                        >

                            <div
                                class="progress-fill"
                                style="
                                    width:${progress}%
                                "
                            ></div>

                        </div>

                    </div>
                `;

            })
            .join("");
}


// =====================================================
// DASHBOARD NAVIGATION
// =====================================================

function setupNavigation() {

    const navLinks =
        document.querySelectorAll(
            ".nav-link[data-section]"
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


                    const sectionId =
                        link.dataset.section;


                    if (sectionId) {

                        const section =
                            getElement(
                                sectionId
                            );


                        if (section) {

                            setTimeout(
                                () => {

                                    section.scrollIntoView({
                                        behavior: "smooth",
                                        block: "start"
                                    });

                                },
                                50
                            );
                        }
                    }
                }
            );
        }
    );
}


// =====================================================
// CLEAR RECENT ACTIVITY
// =====================================================

function setupClearRecentActivity() {

    const button =
        getElement(
            "clearRecentActivity"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            recentActivity = [];


            writeStorage(
                RECENT_ACTIVITY_KEY,
                []
            );


            renderRecentActivity();

            updateContinueLearning();

            updateRecommendedLesson();

            updateLearningProgress();
        }
    );
}


// =====================================================
// NOTIFICATIONS
// =====================================================

function setupNotifications() {

    const button =
        getElement(
            "notificationButton"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            const badge =
                getElement(
                    "notificationBadge"
                );


            if (badge) {

                badge.textContent =
                    "0";
            }


            alert(
                "You have no new notifications."
            );
        }
    );
}


// =====================================================
// DASHBOARD HASH NAVIGATION
// =====================================================

function handleHashNavigation() {

    const hash =
        window.location.hash;


    if (!hash) {
        return;
    }


    const sectionId =
        hash.substring(1);


    const section =
        getElement(
            sectionId
        );


    if (section) {

        setTimeout(
            () => {

                section.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            },
            200
        );
    }
}


// =====================================================
// TRACK UNIT
// =====================================================

function trackUnit(
    courseId,
    courseName,
    unitId,
    unitTitle
) {

    const item = {

        courseId:
            courseId ?? "",

        courseName:
            courseName || "Medical Course",

        unitId:
            unitId ?? "",

        unitTitle:
            unitTitle || "Medical Unit",

        timestamp:
            new Date().toISOString()
    };


    const existing =
        readStorage(
            RECENT_ACTIVITY_KEY,
            []
        );


    const filtered =
        Array.isArray(existing)
            ? existing.filter(
                oldItem => !(
                    String(
                        oldItem.courseId
                    ) ===
                    String(
                        item.courseId
                    ) &&
                    String(
                        oldItem.unitId
                    ) ===
                    String(
                        item.unitId
                    )
                )
            )
            : [];


    filtered.unshift(
        item
    );


    recentActivity =
        filtered.slice(
            0,
            30
        );


    writeStorage(
        RECENT_ACTIVITY_KEY,
        recentActivity
    );


    renderRecentActivity();

    updateContinueLearning();

    updateRecommendedLesson();

    updateLearningProgress();
}


// =====================================================
// QUIZ HISTORY TRACKER
// =====================================================

function saveQuizResult(result) {

    if (!result) {
        return;
    }


    const history =
        readStorage(
            QUIZ_HISTORY_KEY,
            []
        );


    const newResult = {

        ...result,

        timestamp:
            result.timestamp ||
            new Date().toISOString()
    };


    history.unshift(
        newResult
    );


    quizHistory =
        history.slice(
            0,
            100
        );


    writeStorage(
        QUIZ_HISTORY_KEY,
        quizHistory
    );


    updateQuizAnalytics();

    updateLearningProgress();
}


// =====================================================
// FIX INLINE HTML FUNCTIONS
// =====================================================

window.sendTutorMessage =
    window.sendTutorMessage ||
    function () {

        const button =
            getElement(
                "sendTutorMessageButton"
            );


        if (button) {

            button.click();
        }
    };


window.loadStudentAnswers =
    window.loadStudentAnswers ||
    function () {

        const button =
            getElement(
                "loadAnswersButton"
            );


        if (button) {

            button.click();
        }
    };


// =====================================================
// PUBLIC DASHBOARD API
// =====================================================

window.mwanikiTrackUnit =
    trackUnit;


window.mwanikiDashboard = {

    reloadCourses:
        loadCourses,

    reloadNotes:
        loadNotes,

    reloadProfile:
        loadStudentProfile,

    reloadActivity:
        loadRecentActivity,

    saveQuizResult:
        saveQuizResult,

    getCourses:
        () => dashboardCourses,

    getNotes:
        () => dashboardNotes,

    getRecentActivity:
        () => recentActivity
};


// =====================================================
// INITIALIZATION
// =====================================================

async function initializeDashboard() {

    console.log(
        "🚀 Initializing Mwaniki Scholars dashboard..."
    );


    // -------------------------------------------------
    // Local data
    // -------------------------------------------------

    loadRecentActivity();

    loadQuizHistory();


    // -------------------------------------------------
    // UI setup
    // -------------------------------------------------

    setupNavigation();

    setupClearRecentActivity();

    setupNotifications();

    setupCourseSearch();

    setupNotesSearch();


    // -------------------------------------------------
    // Session
    // -------------------------------------------------

    await loadCurrentSession();

    await loadStudentProfile();


    // -------------------------------------------------
    // Supabase content
    // -------------------------------------------------

    await loadCourses();

    await loadNotes();

    await loadCourseProgress();


    // -------------------------------------------------
    // Final analytics refresh
    // -------------------------------------------------

    updateQuizAnalytics();

    updateLearningProgress();

    calculateLearningStreak();

    handleHashNavigation();


    console.log(
        "✅ Mwaniki Scholars dashboard initialized."
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
