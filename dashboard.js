import { supabase } from "./supabase.js";

console.log("🚀 Mwaniki Scholars dashboard.js loaded");


/* =========================================================
   STORAGE KEYS
========================================================= */

const RECENT_ACTIVITY_KEY =
    "mwanikiRecentActivity";

const QUIZ_PROGRESS_KEY =
    "mwanikiQuizProgress";

const QUIZ_HISTORY_KEY =
    "mwanikiQuizHistory";


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;
let currentProfile = null;

let dashboardCourses = [];
let dashboardNotes = [];

let recentActivity = [];
let quizHistory = [];


/* =========================================================
   HELPERS
========================================================= */

function getElement(id) {

    return document.getElementById(id);

}


function setText(id, value) {

    const element =
        getElement(id);

    if (element) {

        element.textContent =
            value;

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


/* =========================================================
   SESSION
========================================================= */

async function loadCurrentSession() {

    try {

        const {
            data,
            error
        } = await supabase.auth.getSession();


        if (error) {

            throw error;

        }


        currentUser =
            data?.session?.user || null;


        return currentUser;


    } catch (error) {

        console.error(
            "❌ Session loading error:",
            error
        );


        currentUser = null;

        return null;

    }

}


/* =========================================================
   STUDENT PROFILE
   IMPORTANT:
   Uses students table, NOT profiles.
========================================================= */

async function loadStudentProfile() {

    const profileButton =
        getElement("studentProfileButton");

    const profileName =
        getElement("dashboardProfileName");

    const profilePhoto =
        getElement("dashboardProfilePhoto");

    const heroPhoto =
        getElement("dashboardHeroProfilePhoto");

    const heroFallback =
        getElement("dashboardHeroFallback");

    const studentHero =
        getElement("studentPersonalProfile");


    /* =====================================================
       NO USER
    ===================================================== */

    if (!currentUser) {

        if (profileName) {

            profileName.textContent =
                "Student";

        }


        if (profilePhoto) {

            profilePhoto.removeAttribute("src");

            profilePhoto.classList.remove(
                "visible"
            );

        }


        if (heroPhoto) {

            heroPhoto.removeAttribute("src");

            heroPhoto.classList.remove(
                "visible"
            );

        }


        if (heroFallback) {

            heroFallback.style.display =
                "inline";

        }


        if (studentHero) {

            const heroHeading =
                studentHero.querySelector(
                    ".hero-content h1"
                );

            if (heroHeading) {

                heroHeading.textContent =
                    "Welcome, Scholar 👋";

            }

        }


        return null;

    }


    /* =====================================================
       LOAD FROM STUDENTS TABLE
    ===================================================== */

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

            throw error;

        }


        currentProfile =
            student;


        /* =================================================
           NAME
        ================================================= */

        const studentName =
            student?.full_name ||
            currentUser.user_metadata?.full_name ||
            currentUser.user_metadata?.name ||
            currentUser.email?.split("@")[0] ||
            "Scholar";


        /* =================================================
           EMAIL
        ================================================= */

        const studentEmail =
            student?.email ||
            currentUser.email ||
            "";


        /* =================================================
           PHOTO URL
        ================================================= */

        const photoURL =
            student?.photo_url ||
            "";


        /* =================================================
           HEADER NAME
        ================================================= */

        if (profileName) {

            profileName.textContent =
                studentName;

        }


        /* =================================================
           HEADER PHOTO
        ================================================= */

        if (profilePhoto) {

            if (photoURL) {

                profilePhoto.src =
                    photoURL;

                profilePhoto.classList.add(
                    "visible"
                );


                profilePhoto.onerror =
                    function () {

                        console.warn(
                            "⚠️ Dashboard profile photo could not be loaded."
                        );

                        this.removeAttribute(
                            "src"
                        );

                        this.classList.remove(
                            "visible"
                        );

                    };

            } else {

                profilePhoto.removeAttribute(
                    "src"
                );

                profilePhoto.classList.remove(
                    "visible"
                );

            }

        }


        /* =================================================
           HERO PHOTO
        ================================================= */

        if (heroPhoto) {

            if (photoURL) {

                heroPhoto.src =
                    photoURL;

                heroPhoto.classList.add(
                    "visible"
                );


                heroPhoto.onerror =
                    function () {

                        console.warn(
                            "⚠️ Hero profile photo could not be loaded."
                        );

                        this.removeAttribute(
                            "src"
                        );

                        this.classList.remove(
                            "visible"
                        );


                        if (heroFallback) {

                            heroFallback.style.display =
                                "inline";

                        }

                    };


                if (heroFallback) {

                    heroFallback.style.display =
                        "none";

                }

            } else {

                heroPhoto.removeAttribute(
                    "src"
                );

                heroPhoto.classList.remove(
                    "visible"
                );


                if (heroFallback) {

                    heroFallback.style.display =
                        "inline";

                }

            }

        }


        /* =================================================
           HERO NAME
        ================================================= */

        if (studentHero) {

            const heroHeading =
                studentHero.querySelector(
                    ".hero-content h1"
                );


            if (heroHeading) {

                heroHeading.textContent =
                    `Welcome back, ${studentName} 👋`;

            }

        }


        /* =================================================
           PROFILE BUTTON
        ================================================= */

        if (profileButton) {

            profileButton.onclick =
                function () {

                    window.location.href =
                        "studentProfile.html";

                };

        }


        /* =================================================
           TUTOR FORM
        ================================================= */

        const studentNameInput =
            getElement("studentName");

        const studentEmailInput =
            getElement("studentEmail");


        if (studentNameInput) {

            studentNameInput.value =
                studentName;

        }


        if (studentEmailInput) {

            studentEmailInput.value =
                studentEmail;

        }


        console.log(
            "✅ Student profile loaded:",
            {
                name: studentName,
                hasPhoto: Boolean(photoURL)
            }
        );


        return student;


    } catch (error) {

        console.error(
            "❌ Student profile loading error:",
            error
        );


        currentProfile =
            null;


        if (profileName) {

            profileName.textContent =
                currentUser.email?.split("@")[0] ||
                "Scholar";

        }


        return null;

    }

}


/* =========================================================
   RECENT ACTIVITY
========================================================= */

function loadRecentActivity() {

    try {

        recentActivity =
            JSON.parse(
                localStorage.getItem(
                    RECENT_ACTIVITY_KEY
                ) || "[]"
            );


        if (!Array.isArray(recentActivity)) {

            recentActivity = [];

        }

    } catch (error) {

        console.error(
            "Recent activity error:",
            error
        );

        recentActivity = [];

    }


    renderRecentActivity();

    return recentActivity;

}


/* =========================================================
   RENDER RECENT ACTIVITY
========================================================= */

function renderRecentActivity() {

    const container =
        getElement("recentlyStudied");

    const continueContainer =
        getElement("continueLearningContent");


    if (!container) {

        return;

    }


    if (!recentActivity.length) {

        container.innerHTML = `
            <div class="empty-state">
                You have not studied any units yet.
            </div>
        `;


        if (continueContainer) {

            continueContainer.innerHTML = `
                <div class="empty-state">
                    Start a course to begin your learning journey.
                </div>
            `;

        }

        return;

    }


    container.innerHTML =
        recentActivity
            .slice(0, 8)
            .map((item) => {

                return `

                    <div class="activity-item">

                        <div class="activity-icon">
                            📖
                        </div>

                        <div class="activity-info">

                            <strong>
                                ${escapeHTML(
                                    item.unitTitle ||
                                    "Medical Unit"
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    item.courseName ||
                                    "Course"
                                )}
                            </span>

                        </div>

                        <button
                            type="button"
                            class="secondary-button continue-unit-button"
                            data-course-id="${escapeHTML(item.courseId)}"
                            data-course-name="${escapeHTML(item.courseName)}"
                            data-unit-id="${escapeHTML(item.unitId)}"
                            data-unit-title="${escapeHTML(item.unitTitle)}"
                        >
                            Continue
                        </button>

                    </div>

                `;

            })
            .join("");


    container
        .querySelectorAll(
            ".continue-unit-button"
        )
        .forEach((button) => {

            button.addEventListener(
                "click",
                () => {

                    openUnitFromRecent(
                        button.dataset.courseId,
                        button.dataset.courseName,
                        button.dataset.unitId,
                        button.dataset.unitTitle
                    );

                }
            );

        });


    if (continueContainer) {

        const latest =
            recentActivity[0];


        continueContainer.innerHTML = `

            <div class="continue-card">

                <div>

                    <span class="section-kicker">
                        LAST STUDIED
                    </span>

                    <h3>
                        ${escapeHTML(
                            latest.unitTitle ||
                            "Continue learning"
                        )}
                    </h3>

                    <p>
                        ${escapeHTML(
                            latest.courseName ||
                            "Medical course"
                        )}
                    </p>

                </div>

                <button
                    type="button"
                    class="primary-button"
                    id="continueLatestButton"
                >
                    Continue Learning →
                </button>

            </div>

        `;


        const continueButton =
            getElement(
                "continueLatestButton"
            );


        if (continueButton) {

            continueButton.onclick =
                () => {

                    openUnitFromRecent(
                        latest.courseId,
                        latest.courseName,
                        latest.unitId,
                        latest.unitTitle
                    );

                };

        }

    }

}


/* =========================================================
   OPEN RECENT UNIT
========================================================= */

function openUnitFromRecent(
    courseId,
    courseName,
    unitId,
    unitTitle
) {

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
        "selectedUnitTitle",
        unitTitle || ""
    );


    window.location.href =
        "course.html";

}


/* =========================================================
   TRACK UNIT
========================================================= */

function trackUnit(
    courseId,
    courseName,
    unitId,
    unitTitle
) {

    const newActivity = {

        courseId:
            String(courseId),

        courseName:
            courseName || "Course",

        unitId:
            String(unitId),

        unitTitle:
            unitTitle || "Unit",

        timestamp:
            new Date().toISOString()

    };


    recentActivity =
        recentActivity.filter(
            item =>
                !(
                    String(item.courseId) ===
                        String(courseId) &&
                    String(item.unitId) ===
                        String(unitId)
                )
        );


    recentActivity.unshift(
        newActivity
    );


    recentActivity =
        recentActivity.slice(
            0,
            30
        );


    localStorage.setItem(
        RECENT_ACTIVITY_KEY,
        JSON.stringify(
            recentActivity
        )
    );


    renderRecentActivity();

    refreshDashboardProgress();

}


/* =========================================================
   LOAD COURSES
========================================================= */

async function loadCourses() {

    const courseArea =
        getElement("courseArea");


    if (courseArea) {

        courseArea.innerHTML = `
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
            .select(
                "id,title,description,image,created_at"
            )
            .order(
                "title",
                {
                    ascending: true
                }
            );


        if (error) {

            throw error;

        }


        dashboardCourses =
            data || [];


        renderCourses(
            dashboardCourses
        );


        setText(
            "totalCourses",
            dashboardCourses.length
        );


        return dashboardCourses;


    } catch (error) {

        console.error(
            "❌ Course loading error:",
            error
        );


        if (courseArea) {

            courseArea.innerHTML = `
                <div class="error-state">
                    ❌ Unable to load courses.
                    <br>
                    ${escapeHTML(error.message)}
                </div>
            `;

        }


        return [];

    }

}


/* =========================================================
   RENDER COURSES
========================================================= */

function renderCourses(courses) {

    const courseArea =
        getElement("courseArea");


    if (!courseArea) {

        return;

    }


    if (!courses.length) {

        courseArea.innerHTML = `
            <div class="empty-state">
                No courses found.
            </div>
        `;

        return;

    }


    courseArea.innerHTML = `

        <div class="course-grid">

            ${courses.map(course => {

                const image =
                    course.image || "";


                return `

                    <article
                        class="course-card"
                    >

                        <div class="course-image">

                            ${
                                image
                                ?
                                `
                                    <img
                                        src="${escapeHTML(image)}"
                                        alt="${escapeHTML(course.title)}"
                                    >
                                `
                                :
                                `
                                    <div class="course-image-placeholder">
                                        🩺
                                    </div>
                                `
                            }

                        </div>


                        <div class="course-card-body">

                            <span class="course-label">
                                MEDICAL COURSE
                            </span>

                            <h3>
                                ${escapeHTML(
                                    course.title
                                )}
                            </h3>


                            <p>
                                ${escapeHTML(
                                    course.description ||
                                    "Explore this medical course."
                                )}
                            </p>


                            <button
                                type="button"
                                class="primary-button open-course-button"
                                data-course-id="${escapeHTML(course.id)}"
                                data-course-name="${escapeHTML(course.title)}"
                            >
                                Open Course →
                            </button>

                        </div>

                    </article>

                `;

            }).join("")}

        </div>

    `;


    courseArea
        .querySelectorAll(
            ".open-course-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    openCourse(
                        button.dataset.courseId,
                        button.dataset.courseName
                    );

                }
            );

        });

}


/* =========================================================
   OPEN COURSE
========================================================= */

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


/* =========================================================
   COURSE SEARCH
========================================================= */

function setupCourseSearch() {

    const search =
        getElement("courseSearch");


    if (!search) {

        return;

    }


    search.addEventListener(
        "input",
        () => {

            const query =
                search.value
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

                        return (

                            String(
                                course.title || ""
                            )
                            .toLowerCase()
                            .includes(query)

                            ||

                            String(
                                course.description || ""
                            )
                            .toLowerCase()
                            .includes(query)

                        );

                    }
                );


            renderCourses(
                filtered
            );

        }
    );

}


/* =========================================================
   LOAD NOTES
========================================================= */

async function loadNotes() {

    const notesArea =
        getElement("notesArea");


    if (notesArea) {

        notesArea.innerHTML = `
            <div class="loading-state">
                Loading notes...
            </div>
        `;

    }


    try {

        const {
            data,
            error
        } = await supabase
            .from("notes")
            .select(
                `
                id,
                course,
                unit,
                file_name,
                file_url,
                created_at,
                course_id,
                unit_id,
                published
                `
            )
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

            throw error;

        }


        dashboardNotes =
            data || [];


        renderNotes(
            dashboardNotes
        );


        return dashboardNotes;


    } catch (error) {

        console.error(
            "❌ Notes loading error:",
            error
        );


        if (notesArea) {

            notesArea.innerHTML = `
                <div class="error-state">
                    ❌ Unable to load notes.
                    <br>
                    ${escapeHTML(error.message)}
                </div>
            `;

        }


        return [];

    }

}


/* =========================================================
   RENDER NOTES
========================================================= */

function renderNotes(notes) {

    const notesArea =
        getElement("notesArea");


    if (!notesArea) {

        return;

    }


    if (!notes.length) {

        notesArea.innerHTML = `
            <div class="empty-state">
                No published notes available yet.
            </div>
        `;

        return;

    }


    notesArea.innerHTML = `

        <div class="notes-grid">

            ${notes.map(note => {

                return `

                    <article class="note-card">

                        <div class="note-icon">
                            📄
                        </div>


                        <div class="note-content">

                            <span class="note-course">
                                ${escapeHTML(
                                    note.course ||
                                    "Medical Notes"
                                )}
                            </span>


                            <h3>
                                ${escapeHTML(
                                    note.file_name ||
                                    "Study Notes"
                                )}
                            </h3>


                            <p>
                                ${escapeHTML(
                                    note.unit ||
                                    "General notes"
                                )}
                            </p>


                            ${
                                note.file_url
                                ?
                                `
                                    <a
                                        href="${escapeHTML(note.file_url)}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="primary-button"
                                    >
                                        📖 View Notes
                                    </a>
                                `
                                :
                                `
                                    <span class="unavailable-note">
                                        File unavailable
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


/* =========================================================
   NOTES SEARCH
========================================================= */

function setupNotesSearch() {

    const search =
        getElement("notesSearch");


    if (!search) {

        return;

    }


    search.addEventListener(
        "input",
        () => {

            const query =
                search.value
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

                        return (

                            String(
                                note.file_name || ""
                            )
                            .toLowerCase()
                            .includes(query)

                            ||

                            String(
                                note.course || ""
                            )
                            .toLowerCase()
                            .includes(query)

                            ||

                            String(
                                note.unit || ""
                            )
                            .toLowerCase()
                            .includes(query)

                        );

                    }
                );


            renderNotes(
                filtered
            );

        }
    );

}


/* =========================================================
   QUIZ HISTORY
========================================================= */

function loadQuizHistory() {

    try {

        quizHistory =
            JSON.parse(
                localStorage.getItem(
                    QUIZ_HISTORY_KEY
                ) || "[]"
            );


        if (!Array.isArray(quizHistory)) {

            quizHistory = [];

        }

    } catch (error) {

        console.error(
            "Quiz history error:",
            error
        );

        quizHistory = [];

    }


    refreshQuizAnalytics();

    return quizHistory;

}


/* =========================================================
   SAVE QUIZ RESULT
========================================================= */

function saveQuizResult(result) {

    const historyItem = {

        ...result,

        timestamp:
            new Date().toISOString()

    };


    quizHistory.unshift(
        historyItem
    );


    quizHistory =
        quizHistory.slice(
            0,
            100
        );


    localStorage.setItem(
        QUIZ_HISTORY_KEY,
        JSON.stringify(
            quizHistory
        )
    );


    refreshQuizAnalytics();

    refreshDashboardProgress();

}


/* =========================================================
   GET SCORE PERCENTAGE
========================================================= */

function getQuizPercentage(item) {

    if (
        typeof item.percentage ===
        "number"
    ) {

        return Math.round(
            item.percentage
        );

    }


    if (
        typeof item.score ===
            "number" &&

        typeof item.total ===
            "number" &&

        item.total > 0
    ) {

        return Math.round(
            (
                item.score /
                item.total
            ) * 100
        );

    }


    if (
        typeof item.score ===
        "number"
    ) {

        return Math.round(
            item.score
        );

    }


    return 0;

}


/* =========================================================
   QUIZ ANALYTICS
========================================================= */

function refreshQuizAnalytics() {

    setText(
        "quizzesAttempted",
        quizHistory.length
    );


    if (!quizHistory.length) {

        setText(
            "averageScore",
            "0%"
        );


        setText(
            "bestQuizScore",
            "0%"
        );


        setText(
            "recentQuizPerformance",
            "No quiz attempts yet."
        );


        setText(
            "weakQuizAreas",
            "Complete quizzes to identify weak areas."
        );


        return;

    }


    const percentages =
        quizHistory.map(
            getQuizPercentage
        );


    const average =
        Math.round(
            percentages.reduce(
                (sum, value) =>
                    sum + value,
                0
            ) /
            percentages.length
        );


    const best =
        Math.max(
            ...percentages
        );


    setText(
        "averageScore",
        `${average}%`
    );


    setText(
        "bestQuizScore",
        `${best}%`
    );


    const recent =
        quizHistory
            .slice(0, 5)
            .map(item => {

                const percentage =
                    getQuizPercentage(
                        item
                    );


                const title =
                    item.unitTitle ||
                    item.unit ||
                    item.courseName ||
                    item.course ||
                    "Quiz";


                return `

                    <div class="quiz-performance-item">

                        <span>
                            ${escapeHTML(title)}
                        </span>

                        <strong>
                            ${percentage}%
                        </strong>

                    </div>

                `;

            })
            .join("");


    setHTML(
        "recentQuizPerformance",
        recent
    );


    const weakAreas = {};


    quizHistory.forEach(item => {

        const percentage =
            getQuizPercentage(item);


        if (percentage >= 60) {

            return;

        }


        const key =
            item.unitTitle ||
            item.unit ||
            item.courseName ||
            item.course ||
            "General";


        if (!weakAreas[key]) {

            weakAreas[key] = [];

        }


        weakAreas[key].push(
            percentage
        );

    });


    const weakKeys =
        Object.keys(
            weakAreas
        )
        .sort(
            (a, b) =>
                averageOf(
                    weakAreas[a]
                ) -
                averageOf(
                    weakAreas[b]
                )
        )
        .slice(0, 5);


    if (!weakKeys.length) {

        setHTML(
            "weakQuizAreas",
            `
                <div class="success-state">
                    🎉 No major weak areas detected.
                </div>
            `
        );

    } else {

        setHTML(
            "weakQuizAreas",
            weakKeys
                .map(key => {

                    const score =
                        Math.round(
                            averageOf(
                                weakAreas[key]
                            )
                        );


                    return `

                        <div class="weak-area-item">

                            <span>
                                ${escapeHTML(key)}
                            </span>

                            <strong>
                                ${score}%
                            </strong>

                        </div>

                    `;

                })
                .join("")
        );

    }

}


/* =========================================================
   AVERAGE
========================================================= */

function averageOf(values) {

    if (!values.length) {

        return 0;

    }


    return (
        values.reduce(
            (a, b) =>
                a + b,
            0
        ) /
        values.length
    );

}


/* =========================================================
   HTML HELPER
========================================================= */

function setHTML(
    id,
    html
) {

    const element =
        getElement(id);


    if (element) {

        element.innerHTML =
            html;

    }

}


/* =========================================================
   PROGRESS
========================================================= */

function calculateCompletedCourses() {

    const courseIds =
        new Set();


    recentActivity.forEach(
        item => {

            if (item.courseId) {

                courseIds.add(
                    String(
                        item.courseId
                    )
                );

            }

        }
    );


    return courseIds.size;

}


/* =========================================================
   CURRENT OVERALL PROGRESS
========================================================= */

function calculateOverallProgress() {

    const totalCourses =
        dashboardCourses.length;


    if (!totalCourses) {

        return 0;

    }


    const attempted =
        quizHistory.length;


    if (!attempted) {

        return 0;

    }


    return Math.min(
        100,
        Math.round(
            (
                attempted /
                totalCourses
            ) * 100
        )
    );

}


/* =========================================================
   REFRESH DASHBOARD PROGRESS
========================================================= */

function refreshDashboardProgress() {

    const percentage =
        calculateOverallProgress();


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


    setText(
        "unitsCompleted",
        recentActivity.length
    );


    setText(
        "coursesCompleted",
        calculateCompletedCourses()
    );


    renderAchievements(
        percentage
    );


    loadCourseProgress();

}


/* =========================================================
   COURSE PROGRESS
========================================================= */

function loadCourseProgress() {

    const area =
        getElement(
            "courseProgressArea"
        );


    if (!area) {

        return;

    }


    if (!dashboardCourses.length) {

        area.innerHTML = `
            <div class="empty-state">
                Course progress will appear here.
            </div>
        `;

        return;

    }


    area.innerHTML =
        dashboardCourses
            .slice(0, 12)
            .map(course => {

                const activities =
                    recentActivity.filter(
                        item =>
                            String(
                                item.courseId
                            ) ===
                            String(
                                course.id
                            )
                    );


                const progress =
                    Math.min(
                        100,
                        activities.length * 10
                    );


                return `

                    <div class="course-progress-item">

                        <div class="course-progress-heading">

                            <strong>
                                ${escapeHTML(
                                    course.title
                                )}
                            </strong>

                            <span>
                                ${progress}%
                            </span>

                        </div>


                        <div class="progress-track">

                            <div
                                class="progress-fill"
                                style="width:${progress}%"
                            ></div>

                        </div>

                    </div>

                `;

            })
            .join("");

}


/* =========================================================
   ACHIEVEMENTS
========================================================= */

function renderAchievements(
    progress
) {

    const area =
        getElement(
            "achievementIndicators"
        );


    if (!area) {

        return;

    }


    const achievements = [

        {
            icon: "🌱",
            title: "First Steps",
            unlocked:
                recentActivity.length >= 1
        },

        {
            icon: "📝",
            title: "Quiz Explorer",
            unlocked:
                quizHistory.length >= 10
        },

        {
            icon: "🔥",
            title: "7-Day Scholar",
            unlocked:
                calculateLearningStreak() >= 7
        },

        {
            icon: "🏆",
            title: "Learning Master",
            unlocked:
                progress >= 75
        }

    ];


    area.innerHTML = `

        <div class="achievement-list">

            ${achievements.map(
                achievement => `

                    <div
                        class="achievement
                        ${
                            achievement.unlocked
                            ? "unlocked"
                            : "locked"
                        }"
                    >

                        <span>
                            ${achievement.icon}
                        </span>

                        <strong>
                            ${escapeHTML(
                                achievement.title
                            )}
                        </strong>

                    </div>

                `
            ).join("")}

        </div>

    `;

}


/* =========================================================
   LEARNING STREAK
========================================================= */

function calculateLearningStreak() {

    if (!recentActivity.length) {

        return 0;

    }


    const dates =
        [
            ...new Set(
                recentActivity
                    .map(
                        item =>
                            new Date(
                                item.timestamp
                            )
                            .toISOString()
                            .slice(
                                0,
                                10
                            )
                    )
            )
        ]
        .sort()
        .reverse();


    if (!dates.length) {

        return 0;

    }


    let streak = 1;


    for (
        let i = 1;
        i < dates.length;
        i++
    ) {

        const current =
            new Date(
                dates[i - 1]
            );


        const previous =
            new Date(
                dates[i]
            );


        const difference =
            Math.round(
                (
                    current -
                    previous
                ) /
                (
                    1000 *
                    60 *
                    60 *
                    24
                )
            );


        if (
            difference === 1
        ) {

            streak++;

        } else {

            break;

        }

    }


    return streak;

}


/* =========================================================
   REFRESH STREAK
========================================================= */

function refreshLearningStreak() {

    const streak =
        calculateLearningStreak();


    setText(
        "learningStreak",
        `${streak} day${streak === 1 ? "" : "s"}`
    );

}


/* =========================================================
   CLEAR ACTIVITY
========================================================= */

function setupClearActivity() {

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

            localStorage.removeItem(
                RECENT_ACTIVITY_KEY
            );

            renderRecentActivity();

            refreshDashboardProgress();

            refreshLearningStreak();

        }
    );

}


/* =========================================================
   NOTIFICATIONS
========================================================= */

function setupNotifications() {

    const button =
        getElement(
            "notificationButton"
        );


    const badge =
        getElement(
            "notificationBadge"
        );


    if (!button) {

        return;

    }


    button.addEventListener(
        "click",
        () => {

            if (badge) {

                badge.textContent =
                    "0";

            }


            alert(
                "🔔 No new notifications."
            );

        }
    );

}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    const links =
        document.querySelectorAll(
            ".nav-link[data-section]"
        );


    links.forEach(link => {

        link.addEventListener(
            "click",
            event => {

                event.preventDefault();


                const sectionId =
                    link.dataset.section;


                const section =
                    getElement(
                        sectionId
                    );


                if (section) {

                    section.scrollIntoView({
                        behavior:
                            "smooth",
                        block:
                            "start"
                    });

                }


                links.forEach(
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

    });


    window.addEventListener(
        "hashchange",
        () => {

            const hash =
                window.location.hash
                    .replace(
                        "#",
                        ""
                    );


            if (!hash) {

                return;

            }


            const section =
                getElement(
                    hash
                );


            if (section) {

                section.scrollIntoView({
                    behavior:
                        "smooth",
                    block:
                        "start"
                });

            }

        }
    );

}


/* =========================================================
   AI SUGGESTIONS
========================================================= */

function setupAISuggestions() {

    const buttons =
        document.querySelectorAll(
            ".suggestion-button"
        );


    const input =
        getElement(
            "aiQuestion"
        );


    if (!input) {

        return;

    }


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    input.value =
                        button.textContent
                            .trim();

                    input.focus();

                }
            );

        }
    );

}


/* =========================================================
   PROFILE BUTTON
========================================================= */

function setupProfileButton() {

    const button =
        getElement(
            "studentProfileButton"
        );


    if (!button) {

        return;

    }


    button.addEventListener(
        "click",
        () => {

            window.location.href =
                "studentProfile.html";

        }
    );

}


/* =========================================================
   REFRESH EVERYTHING
========================================================= */

function refreshAllDashboardData() {

    refreshQuizAnalytics();

    refreshDashboardProgress();

    refreshLearningStreak();

}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeDashboard() {

    console.log(
        "🚀 Initializing Mwaniki Scholars dashboard..."
    );


    /* LOCAL DATA */

    loadRecentActivity();

    loadQuizHistory();


    /* UI */

    setupNavigation();

    setupClearActivity();

    setupNotifications();

    setupCourseSearch();

    setupNotesSearch();

    setupAISuggestions();

    setupProfileButton();


    /* SESSION */

    await loadCurrentSession();


    /* PROFILE */

    await loadStudentProfile();


    /* DATABASE */

    await loadCourses();

    await loadNotes();


    /* ANALYTICS */

    refreshAllDashboardData();


    /* HASH */

    const hash =
        window.location.hash
            .replace(
                "#",
                ""
            );


    if (hash) {

        const section =
            getElement(
                hash
            );


        if (section) {

            setTimeout(
                () => {

                    section.scrollIntoView({
                        behavior:
                            "smooth"
                    });

                },
                300
            );

        }

    }


    console.log(
        "✅ Mwaniki Scholars dashboard initialized."
    );

}


/* =========================================================
   PUBLIC API
========================================================= */

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


/* =========================================================
   START
========================================================= */

initializeDashboard();
