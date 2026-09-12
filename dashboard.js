import { supabase } from "./supabase.js";

/* =========================================================
   MWANIKI SCHOLARS
   STUDENT DASHBOARD ENGINE
   ========================================================= */

console.log("🚀 Mwaniki Scholars Dashboard starting...");


/* =========================================================
   1. GLOBAL STATE
   ========================================================= */

let currentUser = null;
let currentStudent = null;

let dashboardCourses = [];
let dashboardNotes = [];
let recentActivity = [];

const RECENT_ACTIVITY_KEY = "mwanikiRecentActivity";
const QUIZ_PROGRESS_KEY = "mwanikiQuizProgress";
const QUIZ_HISTORY_KEY = "mwanikiQuizHistory";


/* =========================================================
   2. BASIC HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
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


function safeNumber(value, fallback = 0) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


function formatDate(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}


function setText(id, value) {
    const element = $(id);

    if (element) {
        element.textContent = value;
    }
}


function showElement(id) {
    const element = $(id);

    if (element) {
        element.style.display = "";
    }
}


function hideElement(id) {
    const element = $(id);

    if (element) {
        element.style.display = "none";
    }
}


/* =========================================================
   3. AUTHENTICATION
   ========================================================= */

async function getCurrentUser() {

    try {

        const {
            data,
            error
        } = await supabase.auth.getUser();

        if (error) {
            console.error("❌ Unable to get current user:", error);
            return null;
        }

        return data?.user || null;

    } catch (error) {

        console.error("❌ Authentication error:", error);

        return null;
    }
}


/* =========================================================
   4. LOAD STUDENT PROFILE
   ========================================================= */

async function loadStudentProfile() {

    if (!currentUser) {
        return;
    }

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
                "❌ Student profile error:",
                error
            );

            return;
        }


        currentStudent = student;


        const studentName =
            student?.full_name ||
            student?.name ||
            student?.username ||
            currentUser.user_metadata?.full_name ||
            currentUser.user_metadata?.name ||
            "Scholar";


        const studentEmail =
            student?.email ||
            currentUser.email ||
            "";


        /* Header */

        setText(
            "dashboardProfileName",
            studentName
        );


        /* Tutor form */

        const nameInput = $("studentName");

        if (nameInput) {
            nameInput.value = studentName;
        }


        const emailInput = $("studentEmail");

        if (emailInput) {
            emailInput.value = studentEmail;
        }


        const inboxEmail = $("checkEmail");

        if (
            inboxEmail &&
            !inboxEmail.value
        ) {
            inboxEmail.value = studentEmail;
        }


        /* Profile photo */

        const photoURL =
            student?.photo_url ||
            student?.avatar_url ||
            currentUser.user_metadata?.avatar_url ||
            "";


        updateProfilePhotos(photoURL);


        console.log(
            "✅ Student profile loaded:",
            studentName
        );


    } catch (error) {

        console.error(
            "❌ loadStudentProfile failed:",
            error
        );
    }
}


/* =========================================================
   5. PROFILE PHOTO SYSTEM
   ========================================================= */

function updateProfilePhotos(photoURL) {

    const headerPhoto =
        $("dashboardProfilePhoto");

    const heroPhoto =
        $("dashboardHeroProfilePhoto");

    const heroFallback =
        $("dashboardHeroFallback");


    if (photoURL) {

        if (headerPhoto) {

            headerPhoto.src = photoURL;

            headerPhoto.style.display = "block";

            headerPhoto.onerror = () => {
                headerPhoto.style.display = "none";
            };
        }


        if (heroPhoto) {

            heroPhoto.src = photoURL;

            heroPhoto.classList.add("visible");

            heroPhoto.onerror = () => {

                heroPhoto.classList.remove(
                    "visible"
                );

                if (heroFallback) {
                    heroFallback.style.display =
                        "flex";
                }
            };
        }


        if (heroFallback) {
            heroFallback.style.display = "none";
        }

    } else {

        if (headerPhoto) {
            headerPhoto.style.display = "none";
        }

        if (heroPhoto) {
            heroPhoto.classList.remove(
                "visible"
            );
        }

        if (heroFallback) {
            heroFallback.style.display = "flex";
        }
    }
}


/* =========================================================
   6. LOAD COURSES
   ========================================================= */

async function loadCourses() {

    const courseArea =
        $("courseArea");

    if (!courseArea) {
        return;
    }


    courseArea.innerHTML = `
        <div class="loading-state">
            Loading courses...
        </div>
    `;


    try {

        const {
            data,
            error
        } = await supabase
            .from("courses")
            .select("*")
            .order("id", {
                ascending: true
            });


        if (error) {
            throw error;
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


        console.log(
            `✅ Loaded ${dashboardCourses.length} courses`
        );


    } catch (error) {

        console.error(
            "❌ Course loading failed:",
            error
        );


        courseArea.innerHTML = `
            <div class="empty-state">
                Unable to load courses.
                Please refresh the page.
            </div>
        `;
    }
}


/* =========================================================
   7. RENDER COURSES
   ========================================================= */

function renderCourses(courses) {

    const courseArea =
        $("courseArea");

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


    courseArea.innerHTML =
        courses.map(course => {

            const courseID =
                course.id;

            const title =
                course.title ||
                "Untitled Course";

            const description =
                course.description ||
                "Medical learning course";


            const image =
                course.image ||
                "";


            return `
                <article
                    class="course-card"
                    data-course-id="${escapeHTML(courseID)}"
                    tabindex="0"
                >

                    ${
                        image
                            ? `
                                <img
                                    src="${escapeHTML(image)}"
                                    alt="${escapeHTML(title)}"
                                    loading="lazy"
                                    onerror="this.style.display='none'"
                                >
                              `
                            : ""
                    }


                    <h3>
                        ${escapeHTML(title)}
                    </h3>


                    <p>
                        ${escapeHTML(description)}
                    </p>

                </article>
            `;

        }).join("");


    courseArea
        .querySelectorAll(".course-card")
        .forEach(card => {

            card.addEventListener(
                "click",
                () => {

                    openCourse(
                        card.dataset.courseId
                    );
                }
            );


            card.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {

                        event.preventDefault();

                        openCourse(
                            card.dataset.courseId
                        );
                    }
                }
            );

        });
}


/* =========================================================
   8. OPEN COURSE
   ========================================================= */

function openCourse(courseID) {

    const course =
        dashboardCourses.find(
            item =>
                String(item.id) ===
                String(courseID)
        );


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


    addRecentActivity({
        type: "course",
        courseId: course.id,
        courseName: course.title,
        title: course.title,
        timestamp: new Date().toISOString()
    });


    window.location.href =
        `course.html?course_id=${encodeURIComponent(course.id)}`;
}


/* =========================================================
   9. COURSE SEARCH
   ========================================================= */

function setupCourseSearch() {

    const input =
        $("courseSearch");

    if (!input) {
        return;
    }


    input.addEventListener(
        "input",
        () => {

            const search =
                input.value
                    .trim()
                    .toLowerCase();


            if (!search) {

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
                            title.includes(search) ||
                            description.includes(search)
                        );
                    }
                );


            renderCourses(filtered);
        }
    );
}


/* =========================================================
   10. LOAD NOTES
   ========================================================= */

async function loadNotes() {

    const notesArea =
        $("notesArea");

    if (!notesArea) {
        return;
    }


    notesArea.innerHTML = `
        <div class="loading-state">
            Loading notes...
        </div>
    `;


    try {

        /*
         * Notes are read from the public notes table.
         *
         * Only published notes are shown.
         */

        const {
            data,
            error
        } = await supabase
            .from("notes")
            .select("*")
            .eq("published", true)
            .order("created_at", {
                ascending: false
            });


        if (error) {
            throw error;
        }


        dashboardNotes =
            Array.isArray(data)
                ? data
                : [];


        renderNotes(
            dashboardNotes
        );


        console.log(
            `✅ Loaded ${dashboardNotes.length} notes`
        );


    } catch (error) {

        console.error(
            "❌ Notes loading failed:",
            error
        );


        notesArea.innerHTML = `
            <div class="empty-state">
                Unable to load notes.
                Please refresh the page.
            </div>
        `;
    }
}


/* =========================================================
   11. RENDER NOTES
   ========================================================= */

function renderNotes(notes) {

    const notesArea =
        $("notesArea");

    if (!notesArea) {
        return;
    }


    if (!notes.length) {

        notesArea.innerHTML = `
            <div class="empty-state">
                No published notes are available yet.
            </div>
        `;

        return;
    }


    notesArea.innerHTML =
        notes.map(note => {

            const course =
                note.course ||
                "Medical Notes";

            const unit =
                note.unit ||
                "Study Material";

            const fileName =
                note.file_name ||
                "Open Notes";

            const fileURL =
                normalizeNoteURL(
                    note.file_url
                );


            return `
                <article class="note-card">

                    <h3>
                        ${escapeHTML(fileName)}
                    </h3>

                    <p>
                        <strong>
                            ${escapeHTML(course)}
                        </strong>
                        <br>
                        ${escapeHTML(unit)}
                    </p>


                    ${
                        fileURL
                            ? `
                                <a
                                    href="${escapeHTML(fileURL)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="primary-button"
                                >
                                    📄 Open Notes
                                </a>
                              `
                            : `
                                <span class="secondary-button">
                                    File unavailable
                                </span>
                              `
                    }

                </article>
            `;

        }).join("");
}


/* =========================================================
   12. NORMALIZE NOTE URL
   ========================================================= */

function normalizeNoteURL(url) {

    if (!url) {
        return "";
    }


    const value =
        String(url).trim();


    if (
        value.startsWith("http://") ||
        value.startsWith("https://")
    ) {
        return value;
    }


    /*
     * Old relative /notes/... links do not work
     * reliably on GitHub Pages.
     *
     * Keep the URL unchanged rather than guessing
     * a storage path.
     */

    return value;
}


/* =========================================================
   13. NOTES SEARCH
   ========================================================= */

function setupNotesSearch() {

    const input =
        $("notesSearch");

    if (!input) {
        return;
    }


    input.addEventListener(
        "input",
        () => {

            const search =
                input.value
                    .trim()
                    .toLowerCase();


            if (!search) {

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
                            fileName.includes(search) ||
                            course.includes(search) ||
                            unit.includes(search)
                        );
                    }
                );


            renderNotes(filtered);
        }
    );
}


/* =========================================================
   14. RECENT ACTIVITY
   ========================================================= */

function loadRecentActivity() {

    try {

        const saved =
            localStorage.getItem(
                RECENT_ACTIVITY_KEY
            );


        recentActivity =
            saved
                ? JSON.parse(saved)
                : [];


        if (!Array.isArray(recentActivity)) {
            recentActivity = [];
        }


    } catch (error) {

        console.error(
            "❌ Recent activity error:",
            error
        );

        recentActivity = [];
    }


    renderRecentActivity();

    renderContinueLearning();

    renderRecommendedLesson();
}


/* =========================================================
   15. SAVE ACTIVITY
   ========================================================= */

function saveRecentActivity() {

    try {

        localStorage.setItem(
            RECENT_ACTIVITY_KEY,
            JSON.stringify(
                recentActivity.slice(0, 20)
            )
        );

    } catch (error) {

        console.error(
            "❌ Could not save activity:",
            error
        );
    }
}


/* =========================================================
   16. ADD RECENT ACTIVITY
   ========================================================= */

function addRecentActivity(activity) {

    if (!activity) {
        return;
    }


    recentActivity =
        recentActivity.filter(item => {

            return !(
                item.courseId === activity.courseId &&
                item.unitId === activity.unitId &&
                item.type === activity.type
            );
        });


    recentActivity.unshift({
        ...activity,
        timestamp:
            activity.timestamp ||
            new Date().toISOString()
    });


    recentActivity =
        recentActivity.slice(0, 20);


    saveRecentActivity();

    renderRecentActivity();

    renderContinueLearning();

    renderRecommendedLesson();
}


/* =========================================================
   17. RENDER RECENT ACTIVITY
   ========================================================= */

function renderRecentActivity() {

    const container =
        $("recentlyStudied");

    if (!container) {
        return;
    }


    if (!recentActivity.length) {

        container.innerHTML = `
            <div class="empty-state">
                No recent activity yet.
            </div>
        `;

        return;
    }


    container.innerHTML =
        recentActivity
            .slice(0, 8)
            .map(activity => {

                const title =
                    activity.title ||
                    activity.unitTitle ||
                    activity.courseName ||
                    "Study Activity";


                const type =
                    activity.type === "unit"
                        ? "Unit"
                        : activity.type === "course"
                            ? "Course"
                            : "Learning";


                return `
                    <div class="inbox-message">

                        <h3>
                            ${escapeHTML(title)}
                        </h3>

                        <p>
                            ${escapeHTML(type)}
                            ${
                                activity.timestamp
                                    ? ` • ${escapeHTML(
                                        formatDate(
                                            activity.timestamp
                                        )
                                    )}`
                                    : ""
                            }
                        </p>

                    </div>
                `;

            })
            .join("");
}


/* =========================================================
   18. CONTINUE LEARNING
   ========================================================= */

function renderContinueLearning() {

    const container =
        $("continueLearningContent");

    if (!container) {
        return;
    }


    const latest =
        recentActivity.find(
            item =>
                item.type === "unit" ||
                item.type === "course"
        );


    if (!latest) {

        container.innerHTML = `
            <div class="empty-state">
                Start a course to see your
                learning activity here.
            </div>
        `;

        return;
    }


    const title =
        latest.unitTitle ||
        latest.title ||
        latest.courseName ||
        "Continue Learning";


    container.innerHTML = `
        <div class="course-progress-item">

            <h3>
                ${escapeHTML(title)}
            </h3>

            <div class="course-progress-meta">

                <span>
                    ${
                        latest.courseName
                            ? escapeHTML(
                                latest.courseName
                            )
                            : "Medical Learning"
                    }
                </span>

                <span>
                    Continue
                </span>

            </div>

        </div>
    `;
}


/* =========================================================
   19. RECOMMENDED LESSON
   ========================================================= */

function renderRecommendedLesson() {

    const container =
        $("recommendedLesson");

    if (!container) {
        return;
    }


    if (!dashboardCourses.length) {

        container.innerHTML = `
            <div class="empty-state">
                Recommendations will appear here.
            </div>
        `;

        return;
    }


    const recentCourseIDs =
        recentActivity
            .filter(
                item =>
                    item.courseId !== undefined
            )
            .map(
                item =>
                    String(item.courseId)
            );


    const recommendation =
        dashboardCourses.find(
            course =>
                !recentCourseIDs.includes(
                    String(course.id)
                )
        ) ||
        dashboardCourses[0];


    container.innerHTML = `
        <div class="course-progress-item">

            <h3>
                ${escapeHTML(
                    recommendation.title ||
                    "Recommended Course"
                )}
            </h3>

            <div class="course-progress-meta">

                <span>
                    Recommended for you
                </span>

                <button
                    type="button"
                    class="secondary-button"
                    data-recommended-course="${escapeHTML(
                        recommendation.id
                    )}"
                >
                    Explore
                </button>

            </div>

        </div>
    `;


    const button =
        container.querySelector(
            "[data-recommended-course]"
        );


    if (button) {

        button.addEventListener(
            "click",
            () => {

                openCourse(
                    button.dataset.recommendedCourse
                );
            }
        );
    }
}


/* =========================================================
   20. CLEAR RECENT ACTIVITY
   ========================================================= */

function setupClearActivity() {

    const button =
        $("clearRecentActivity");

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

            renderContinueLearning();

            renderRecommendedLesson();
        }
    );
}


/* =========================================================
   21. TRACK UNIT
   ========================================================= */

function trackUnit(unit) {

    if (!unit) {
        return;
    }


    addRecentActivity({

        type: "unit",

        courseId:
            unit.course_id ??
            unit.courseId,

        courseName:
            unit.course_name ??
            unit.courseName ??
            localStorage.getItem(
                "selectedCourseName"
            ),

        unitId:
            unit.id ??
            unit.unit_id ??
            unit.unitId,

        unitTitle:
            unit.title ??
            unit.unitTitle,

        title:
            unit.title ??
            unit.unitTitle,

        timestamp:
            new Date().toISOString()
    });
}


/* =========================================================
   22. QUIZ HISTORY
   ========================================================= */

function getQuizHistory() {

    try {

        const saved =
            localStorage.getItem(
                QUIZ_HISTORY_KEY
            );


        const parsed =
            saved
                ? JSON.parse(saved)
                : [];


        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.error(
            "❌ Quiz history error:",
            error
        );

        return [];
    }
}


/* =========================================================
   23. SAVE QUIZ RESULT
   ========================================================= */

function saveQuizResult(result) {

    if (!result) {
        return;
    }


    const history =
        getQuizHistory();


    history.unshift({

        ...result,

        timestamp:
            result.timestamp ||
            new Date().toISOString()
    });


    const trimmed =
        history.slice(0, 100);


    localStorage.setItem(
        QUIZ_HISTORY_KEY,
        JSON.stringify(trimmed)
    );


    updateQuizStatistics();

    updateOverallProgress();
}


/* =========================================================
   24. UPDATE QUIZ STATISTICS
   ========================================================= */

function updateQuizStatistics() {

    const history =
        getQuizHistory();


    setText(
        "quizzesAttempted",
        history.length
    );


    if (!history.length) {

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

        return;
    }


    const scores =
        history
            .map(item => {

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

                return 0;
            });


    const average =
        scores.reduce(
            (sum, value) =>
                sum + value,
            0
        ) / scores.length;


    const best =
        Math.max(...scores);


    setText(
        "averageScore",
        `${Math.round(average)}%`
    );


    setText(
        "bestQuizScore",
        `${Math.round(best)}%`
    );


    const recent =
        history.slice(0, 5);


    const performance =
        recent.map(item => {

            const score =
                item.percentage !== undefined
                    ? safeNumber(
                        item.percentage
                    )
                    : (
                        safeNumber(item.total) > 0
                            ? (
                                safeNumber(item.score) /
                                safeNumber(item.total)
                            ) * 100
                            : 0
                    );


            const title =
                item.unitTitle ||
                item.courseName ||
                item.title ||
                "Quiz";


            return `
                <div style="margin-bottom:8px;">
                    <strong>
                        ${escapeHTML(title)}
                    </strong>
                    —
                    ${Math.round(score)}%
                </div>
            `;

        }).join("");


    const recentContainer =
        $("recentQuizPerformance");


    if (recentContainer) {
        recentContainer.innerHTML =
            performance;
    }
}


/* =========================================================
   25. OVERALL PROGRESS
   ========================================================= */

function updateOverallProgress() {

    const history =
        getQuizHistory();


    const courseCount =
        dashboardCourses.length;


    const quizProgress =
        history.length > 0
            ? Math.min(
                100,
                history.length * 5
            )
            : 0;


    const progress =
        courseCount > 0
            ? Math.round(
                quizProgress
            )
            : 0;


    const bar =
        $("overallProgressBar");


    if (bar) {
        bar.style.width =
            `${progress}%`;
    }


    setText(
        "overallProgressText",
        `${progress}%`
    );


    renderAchievements(progress);
}


/* =========================================================
   26. ACHIEVEMENTS
   ========================================================= */

function renderAchievements(progress) {

    const container =
        $("achievementIndicators");

    if (!container) {
        return;
    }


    const history =
        getQuizHistory();


    const achievements = [];


    if (history.length >= 1) {
        achievements.push(
            "🎯 First Quiz"
        );
    }


    if (history.length >= 5) {
        achievements.push(
            "🔥 Quiz Explorer"
        );
    }


    if (progress >= 25) {
        achievements.push(
            "📚 Learning Momentum"
        );
    }


    if (progress >= 50) {
        achievements.push(
            "🏆 Halfway Scholar"
        );
    }


    if (progress >= 100) {
        achievements.push(
            "🥇 Master Scholar"
        );
    }


    if (!achievements.length) {

        container.innerHTML = `
            <div class="empty-state">
                Complete your first quiz
                to unlock achievements.
            </div>
        `;

        return;
    }


    container.innerHTML =
        achievements.map(
            item => `
                <span class="achievement-item">
                    ${escapeHTML(item)}
                </span>
            `
        ).join("");
}


/* =========================================================
   27. UNITS COMPLETED
   ========================================================= */

function updateUnitStatistics() {

    const units =
        recentActivity.filter(
            item =>
                item.type === "unit"
        );


    setText(
        "unitsCompleted",
        units.length
    );


    const courseIDs =
        new Set(
            units
                .map(
                    item =>
                        item.courseId
                )
                .filter(
                    value =>
                        value !== undefined &&
                        value !== null
                )
                .map(
                    value =>
                        String(value)
                )
        );


    setText(
        "coursesCompleted",
        courseIDs.size
    );
}


/* =========================================================
   28. LEARNING STREAK
   ========================================================= */

function updateLearningStreak() {

    if (!recentActivity.length) {

        setText(
            "learningStreak",
            "0 days"
        );

        return;
    }


    const dates = [
        ...new Set(
            recentActivity
                .map(item => {

                    if (!item.timestamp) {
                        return null;
                    }

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
                })
                .filter(Boolean)
        )
    ];


    if (!dates.length) {

        setText(
            "learningStreak",
            "0 days"
        );

        return;
    }


    dates.sort(
        (a, b) =>
            new Date(b) -
            new Date(a)
    );


    let streak = 1;


    for (
        let index = 1;
        index < dates.length;
        index++
    ) {

        const previous =
            new Date(
                dates[index - 1]
            );

        const current =
            new Date(
                dates[index]
            );


        const difference =
            Math.round(
                (
                    previous -
                    current
                ) /
                (
                    1000 *
                    60 *
                    60 *
                    24
                )
            );


        if (difference === 1) {
            streak++;
        } else {
            break;
        }
    }


    setText(
        "learningStreak",
        `${streak} day${streak === 1 ? "" : "s"}`
    );
}


/* =========================================================
   29. COURSE PROGRESS AREA
   ========================================================= */

function renderCourseProgress() {

    const container =
        $("courseProgressArea");

    if (!container) {
        return;
    }


    if (!dashboardCourses.length) {

        container.innerHTML = `
            <div class="empty-state">
                Course progress will appear here.
            </div>
        `;

        return;
    }


    const activityByCourse =
        {};


    recentActivity.forEach(item => {

        if (
            item.courseId === undefined ||
            item.courseId === null
        ) {
            return;
        }


        const id =
            String(item.courseId);


        if (!activityByCourse[id]) {
            activityByCourse[id] = 0;
        }


        if (item.type === "unit") {
            activityByCourse[id]++;
        }
    });


    const visibleCourses =
        dashboardCourses
            .filter(course =>
                activityByCourse[
                    String(course.id)
                ] > 0
            )
            .slice(0, 8);


    if (!visibleCourses.length) {

        container.innerHTML = `
            <div class="empty-state">
                Start studying a course to
                see your progress here.
            </div>
        `;

        return;
    }


    container.innerHTML =
        visibleCourses.map(course => {

            const count =
                activityByCourse[
                    String(course.id)
                ] || 0;


            const progress =
                Math.min(
                    100,
                    count * 10
                );


            return `
                <div class="course-progress-item">

                    <h3>
                        ${escapeHTML(
                            course.title ||
                            "Course"
                        )}
                    </h3>


                    <div class="course-progress-meta">

                        <span>
                            ${count} unit
                            ${count === 1 ? "" : "s"} studied
                        </span>

                        <strong>
                            ${progress}%
                        </strong>

                    </div>


                    <div class="progress-track">

                        <div
                            class="progress-fill"
                            style="width:${progress}%"
                        ></div>

                    </div>

                </div>
            `;

        }).join("");
}


/* =========================================================
   30. TUTOR MESSAGING
   ========================================================= */

function setupTutorMessaging() {

    const button =
        $("sendTutorMessageButton");

    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        sendTutorMessage
    );
}


async function sendTutorMessage() {

    const topic =
        $("topic")?.value.trim() || "";

    const message =
        $("studentMessage")
            ?.value
            .trim() || "";

    const status =
        $("messageStatus");


    if (!topic) {

        if (status) {
            status.textContent =
                "Please enter a topic.";
        }

        return;
    }


    if (!message) {

        if (status) {
            status.textContent =
                "Please write your message.";
        }

        return;
    }


    if (!currentUser) {

        if (status) {
            status.textContent =
                "Please sign in again.";
        }

        return;
    }


    buttonState(
        "sendTutorMessageButton",
        true,
        "Sending..."
    );


    try {

        /*
         * Uses the tutor_messages table.
         *
         * If your existing table has different
         * columns, keep the database structure
         * already used by your project.
         */

        const {
            error
        } = await supabase
            .from("tutor_messages")
            .insert({

                student_id:
                    currentUser.id,

                student_name:
                    $("studentName")?.value ||
                    currentStudent?.full_name ||
                    "",

                student_email:
                    $("studentEmail")?.value ||
                    currentUser.email ||
                    "",

                topic,

                message,

                created_at:
                    new Date().toISOString()

            });


        if (error) {
            throw error;
        }


        if (status) {

            status.textContent =
                "Message sent successfully.";
        }


        $("topic").value = "";

        $("studentMessage").value = "";


    } catch (error) {

        console.error(
            "❌ Tutor message error:",
            error
        );


        if (status) {

            status.textContent =
                "Unable to send message. Please try again.";
        }

    } finally {

        buttonState(
            "sendTutorMessageButton",
            false,
            "📨 Send Message"
        );
    }
}


/* =========================================================
   31. INBOX
   ========================================================= */

function setupInbox() {

    const button =
        $("loadAnswersButton");

    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        loadStudentInbox
    );
}


async function loadStudentInbox() {

    const inbox =
        $("studentInbox");

    const email =
        $("checkEmail")
            ?.value
            .trim();


    if (!inbox) {
        return;
    }


    if (!email) {

        inbox.innerHTML = `
            <div class="empty-state">
                Enter your email to load tutor replies.
            </div>
        `;

        return;
    }


    inbox.innerHTML = `
        <div class="loading-state">
            Loading tutor replies...
        </div>
    `;


    try {

        /*
         * First try the existing tutor_messages table.
         */

        const {
            data,
            error
        } = await supabase
            .from("tutor_messages")
            .select("*")
            .eq("student_email", email)
            .order("created_at", {
                ascending: false
            });


        if (error) {
            throw error;
        }


        const messages =
            Array.isArray(data)
                ? data
                : [];


        if (!messages.length) {

            inbox.innerHTML = `
                <div class="empty-state">
                    No tutor replies found yet.
                </div>
            `;

            return;
        }


        inbox.innerHTML =
            messages.map(message => {

                const topic =
                    message.topic ||
                    "Tutor Message";


                const reply =
                    message.reply ||
                    message.response ||
                    message.answer ||
                    message.tutor_reply ||
                    "";


                const status =
                    message.status ||
                    "";


                return `
                    <div class="inbox-message">

                        <h3>
                            ${escapeHTML(topic)}
                        </h3>


                        ${
                            reply
                                ? `
                                    <p>
                                        ${escapeHTML(
                                            reply
                                        )}
                                    </p>
                                  `
                                : `
                                    <p>
                                        Your message has been received.
                                        ${
                                            status
                                                ? escapeHTML(
                                                    status
                                                )
                                                : "Waiting for tutor response."
                                        }
                                    </p>
                                  `
                        }


                        ${
                            message.created_at
                                ? `
                                    <small>
                                        ${escapeHTML(
                                            formatDate(
                                                message.created_at
                                            )
                                        )}
                                    </small>
                                  `
                                : ""
                        }

                    </div>
                `;

            }).join("");


    } catch (error) {

        console.error(
            "❌ Inbox loading failed:",
            error
        );


        inbox.innerHTML = `
            <div class="empty-state">
                Unable to load tutor replies.
            </div>
        `;
    }
}


/* =========================================================
   32. NOTIFICATION BUTTON
   ========================================================= */

function setupNotifications() {

    const button =
        $("notificationButton");

    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            const inbox =
                $("studentInboxSection");

            if (inbox) {

                inbox.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        }
    );
}


/* =========================================================
   33. PROFILE BUTTON
   ========================================================= */

function setupProfileButton() {

    const button =
        $("studentProfileButton");

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
   34. NAVIGATION
   ========================================================= */

function setupNavigation() {

    const links =
        document.querySelectorAll(
            ".nav-link[data-section]"
        );


    links.forEach(link => {

        link.addEventListener(
            "click",
            () => {

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


    const mobileLinks =
        document.querySelectorAll(
            ".mobile-bottom-nav a"
        );


    mobileLinks.forEach(link => {

        link.addEventListener(
            "click",
            () => {

                const target =
                    link.getAttribute(
                        "href"
                    );


                if (!target) {
                    return;
                }


                const element =
                    document.querySelector(
                        target
                    );


                if (element) {

                    setTimeout(
                        () => {

                            element.scrollIntoView({
                                behavior: "smooth",
                                block: "start"
                            });

                        },
                        20
                    );
                }
            }
        );
    });
}


/* =========================================================
   35. AI SUGGESTIONS
   ========================================================= */

function setupAISuggestions() {

    const buttons =
        document.querySelectorAll(
            ".suggestion-button"
        );


    const input =
        $("aiQuestion");


    if (!input) {
        return;
    }


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                input.value =
                    button.textContent.trim();

                input.focus();
            }
        );
    });
}


/* =========================================================
   36. AI BUTTON
   ========================================================= */

function setupAIButton() {

    const button =
        $("askAIButton");

    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            const question =
                $("aiQuestion")
                    ?.value
                    .trim();


            const answer =
                $("aiAnswer");


            if (!question) {

                if (answer) {
                    answer.textContent =
                        "Please enter a medical question.";
                }

                return;
            }


            /*
             * Keep this connected to the existing
             * aiTutor.js system rather than creating
             * a second AI implementation here.
             */

            if (
                typeof window.askMwanikiAI ===
                "function"
            ) {

                window.askMwanikiAI(
                    question
                );

                return;
            }


            if (answer) {

                answer.textContent =
                    "AI Tutor is loading. Please make sure aiTutor.js is connected.";
            }
        }
    );
}


/* =========================================================
   37. BUTTON STATE
   ========================================================= */

function buttonState(
    id,
    loading,
    loadingText
) {

    const button = $(id);

    if (!button) {
        return;
    }


    if (loading) {

        button.disabled = true;

        button.dataset.originalText =
            button.textContent;

        button.textContent =
            loadingText;

    } else {

        button.disabled = false;

        button.textContent =
            button.dataset.originalText ||
            button.textContent;
    }
}


/* =========================================================
   38. REFRESH DASHBOARD STATISTICS
   ========================================================= */

function refreshDashboardStatistics() {

    updateUnitStatistics();

    updateQuizStatistics();

    updateLearningStreak();

    updateOverallProgress();

    renderCourseProgress();
}


/* =========================================================
   39. PUBLIC DASHBOARD API
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
   40. INITIALIZE DASHBOARD
   ========================================================= */

async function initializeDashboard() {

    console.log(
        "🚀 Initializing Mwaniki Scholars Dashboard..."
    );


    currentUser =
        await getCurrentUser();


    if (!currentUser) {

        console.warn(
            "⚠️ No authenticated student found."
        );


        /*
         * Do not immediately redirect here.
         * This prevents the dashboard from breaking
         * while Supabase session restoration is occurring.
         */

        setText(
            "dashboardProfileName",
            "Scholar"
        );

    } else {

        await loadStudentProfile();
    }


    /* Load dashboard content */

    await loadCourses();

    await loadNotes();


    /* Local activity */

    loadRecentActivity();


    /* Statistics */

    refreshDashboardStatistics();


    /* Event listeners */

    setupCourseSearch();

    setupNotesSearch();

    setupClearActivity();

    setupTutorMessaging();

    setupInbox();

    setupNotifications();

    setupProfileButton();

    setupNavigation();

    setupAISuggestions();

    setupAIButton();


    console.log(
        "✅ Mwaniki Scholars Dashboard ready."
    );
}


/* =========================================================
   41. START
   ========================================================= */

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
/* =========================================================
   FINAL BRAND TEXT CLARITY FIX
========================================================= */

.dashboard-header .brand-area,
.dashboard-header .brand-text,
.dashboard-header .brand-name,
.dashboard-header .brand-subtitle {
    opacity: 1 !important;
    visibility: visible !important;
    filter: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    transform: none !important;
    text-shadow: none !important;
    mix-blend-mode: normal !important;
    isolation: isolate !important;
}

.dashboard-header .brand-text {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: flex-start !important;
    gap: 4px !important;
    min-width: 0 !important;
}

.dashboard-header .brand-name {
    display: block !important;
    color: #ffffff !important;
    font-family: Arial, Helvetica, sans-serif !important;
    font-size: 22px !important;
    font-weight: 800 !important;
    line-height: 1.15 !important;
    letter-spacing: -0.2px !important;
    white-space: nowrap !important;
}

.dashboard-header .brand-subtitle {
    display: block !important;
    color: #ffffff !important;
    font-family: Arial, Helvetica, sans-serif !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    line-height: 1.2 !important;
    letter-spacing: 0 !important;
    white-space: nowrap !important;
}

.dashboard-header .brand-icon {
    opacity: 1 !important;
    filter: none !important;
    transform: none !important;
    color: #ffffff !important;
    font-size: 30px !important;
    line-height: 1 !important;
}

/* Prevent any transparent overlay from covering the brand */
.dashboard-header .brand-area::before,
.dashboard-header .brand-area::after,
.dashboard-header .brand-text::before,
.dashboard-header .brand-text::after {
    content: none !important;
    display: none !important;
}
