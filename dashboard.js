import { supabase } from "./supabase.js";

/* =====================================================
   MWANIKI SCHOLARS
   STUDENT DASHBOARD ENGINE
===================================================== */

console.log("🚀 Mwaniki Scholars dashboard starting...");


/* =====================================================
   STATE
===================================================== */

let currentUser = null;
let currentStudent = null;

let dashboardCourses = [];
let dashboardNotes = [];

let dashboardQuizCount = 0;


/* =====================================================
   HELPERS
===================================================== */

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


function setText(id, value) {

    const element = $(id);

    if (!element) {
        return;
    }

    element.textContent =
        value === null ||
        value === undefined ||
        value === ""
            ? "Not available"
            : value;
}


function getInitials(name) {

    if (!name) {
        return "S";
    }

    const parts =
        String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    if (!parts.length) {
        return "S";
    }

    if (parts.length === 1) {
        return parts[0]
            .charAt(0)
            .toUpperCase();
    }

    return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
    ).toUpperCase();
}


function formatDate(dateValue) {

    if (!dateValue) {
        return "—";
    }

    const date =
        new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}


/* =====================================================
   DATE
===================================================== */

function setupCurrentDate() {

    const element =
        $("currentDate");

    if (!element) {
        return;
    }

    const now =
        new Date();

    element.textContent =
        now.toLocaleDateString(
            undefined,
            {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );
}


/* =====================================================
   AUTH USER
===================================================== */

async function loadCurrentUser() {

    try {

        const {
            data,
            error
        } =
            await supabase.auth.getUser();

        if (error) {

            console.error(
                "❌ Could not load authenticated user:",
                error
            );

            return null;
        }

        currentUser =
            data?.user || null;

        return currentUser;

    } catch (error) {

        console.error(
            "❌ Auth error:",
            error
        );

        return null;
    }
}


/* =====================================================
   STUDENT PROFILE
===================================================== */

async function loadStudentProfile() {

    if (!currentUser) {
        return;
    }

    try {

        const {
            data,
            error
        } =
            await supabase
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

            console.warn(
                "⚠️ Student profile could not be loaded:",
                error
            );

            currentStudent = null;

        } else {

            currentStudent = data || null;
        }


        const metadata =
            currentUser.user_metadata || {};


        const studentName =
            currentStudent?.full_name ||
            metadata.full_name ||
            metadata.name ||
            currentUser.email?.split("@")[0] ||
            "Student";


        const studentEmail =
            currentStudent?.email ||
            currentUser.email ||
            "Not available";


        updateStudentIdentity(
            studentName,
            studentEmail
        );


        setText(
            "profilePanelCourse",
            currentStudent?.course || "Not available"
        );


        setText(
            "profilePanelLevel",
            currentStudent?.level || "Not available"
        );


    } catch (error) {

        console.error(
            "❌ Student profile error:",
            error
        );
    }
}


/* =====================================================
   UPDATE STUDENT IDENTITY
===================================================== */

function updateStudentIdentity(
    name,
    email
) {

    setText(
        "profileName",
        name
    );

    setText(
        "profilePanelName",
        name
    );

    setText(
        "profilePanelEmail",
        email
    );


    const initial =
        getInitials(name);


    setText(
        "profileInitial",
        initial
    );


    setText(
        "profilePanelAvatar",
        initial
    );


    const welcome =
        $("welcomeMessage");


    if (welcome) {

        welcome.textContent =
            `Welcome back, ${name} 👋`;
    }
}


/* =====================================================
   COURSES
===================================================== */

async function loadCourses() {

    const recommended =
        $("recommendedCourses");

    const library =
        $("courseLibrary");


    try {

        if (recommended) {

            recommended.innerHTML =
                `<div class="loading-card">
                    Loading courses...
                </div>`;
        }


        if (library) {

            library.innerHTML =
                `<div class="loading-card">
                    Loading course library...
                </div>`;
        }


        const {
            data,
            error
        } =
            await supabase
                .from("courses")
                .select("*")
                .order(
                    "id",
                    {
                        ascending: true
                    }
                );


        if (error) {

            console.error(
                "❌ Course loading failed:",
                error
            );

            showCourseError(
                "Unable to load courses right now."
            );

            return;
        }


        dashboardCourses =
            Array.isArray(data)
                ? data
                : [];


        setText(
            "totalCourses",
            dashboardCourses.length
        );


        renderRecommendedCourses();

        renderCourseLibrary();

        renderRecentCourse();

    } catch (error) {

        console.error(
            "❌ Course error:",
            error
        );

        showCourseError(
            "Something went wrong while loading courses."
        );
    }
}


/* =====================================================
   COURSE ICON
===================================================== */

function getCourseIcon(courseTitle) {

    const title =
        String(courseTitle || "")
            .toLowerCase();


    if (
        title.includes("physiology") ||
        title.includes("cardio")
    ) {
        return "🫀";
    }


    if (
        title.includes("pharmac")
    ) {
        return "💊";
    }


    if (
        title.includes("micro")
    ) {
        return "🦠";
    }


    if (
        title.includes("pathology")
    ) {
        return "🔬";
    }


    if (
        title.includes("parasit")
    ) {
        return "🪱";
    }


    if (
        title.includes("mycology") ||
        title.includes("fung")
    ) {
        return "🍄";
    }


    if (
        title.includes("hemat")
    ) {
        return "🩸";
    }


    if (
        title.includes("immun")
    ) {
        return "🛡️";
    }


    if (
        title.includes("anatom")
    ) {
        return "🦴";
    }


    if (
        title.includes("biochem")
    ) {
        return "🧪";
    }


    if (
        title.includes("genetics")
    ) {
        return "🧬";
    }


    if (
        title.includes("micro")
    ) {
        return "🧫";
    }


    return "📚";
}


/* =====================================================
   COURSE URL
===================================================== */

function getCourseURL(course) {

    const id =
        course?.id;

    if (!id) {
        return "./course.html";
    }

    return `./course.html?course=${encodeURIComponent(id)}`;
}


/* =====================================================
   OPEN COURSE
===================================================== */

function openCourse(course) {

    if (!course) {
        return;
    }


    const courseId =
        course.id;


    const courseName =
        course.title || "";


    localStorage.setItem(
        "selectedCourse",
        String(courseId)
    );


    localStorage.setItem(
        "selectedCourseName",
        courseName
    );


    localStorage.setItem(
        "mwanikiLastCourse",
        JSON.stringify({
            id: courseId,
            title: courseName,
            image: course.image || "",
            openedAt: new Date().toISOString()
        })
    );


    window.location.href =
        getCourseURL(course);
}


/* =====================================================
   COURSE CARD
===================================================== */

function createCourseCard(course) {

    const title =
        course.title ||
        "Untitled Course";


    const description =
        course.description ||
        "Explore this medical course and begin learning.";


    const icon =
        getCourseIcon(title);


    const image =
        course.image;


    const imageHTML =
        image
            ? `
                <div class="course-card-image">
                    <img
                        src="${escapeHTML(image)}"
                        alt="${escapeHTML(title)}"
                        loading="lazy"
                    >
                </div>
              `
            : `
                <div class="course-card-image">
                    ${icon}
                </div>
              `;


    return `
        <article class="course-card">

            ${imageHTML}

            <div class="course-card-body">

                <h3>
                    ${escapeHTML(title)}
                </h3>

                <p>
                    ${escapeHTML(description)}
                </p>

                <a
                    href="${getCourseURL(course)}"
                    class="course-card-button"
                    data-course-id="${escapeHTML(course.id)}"
                >
                    Open Course →
                </a>

            </div>

        </article>
    `;
}


/* =====================================================
   RECOMMENDED
===================================================== */

function renderRecommendedCourses() {

    const container =
        $("recommendedCourses");


    if (!container) {
        return;
    }


    if (!dashboardCourses.length) {

        container.innerHTML =
            `<div class="loading-card">
                No courses are available yet.
            </div>`;

        return;
    }


    let recentCourseId =
        localStorage.getItem(
            "selectedCourse"
        );


    let recommended =
        dashboardCourses.filter(
            course =>
                String(course.id) !==
                String(recentCourseId)
        );


    if (!recommended.length) {
        recommended =
            dashboardCourses;
    }


    recommended =
        recommended.slice(0, 4);


    container.innerHTML =
        recommended
            .map(createCourseCard)
            .join("");


    attachCourseLinks(container);
}


/* =====================================================
   FULL LIBRARY
===================================================== */

function renderCourseLibrary() {

    const container =
        $("courseLibrary");


    if (!container) {
        return;
    }


    if (!dashboardCourses.length) {

        container.innerHTML =
            `<div class="loading-card">
                No courses are available.
            </div>`;

        return;
    }


    container.innerHTML =
        dashboardCourses
            .map(createCourseCard)
            .join("");


    attachCourseLinks(container);
}


/* =====================================================
   COURSE LINKS
===================================================== */

function attachCourseLinks(container) {

    const links =
        container.querySelectorAll(
            "[data-course-id]"
        );


    links.forEach(link => {

        link.addEventListener(
            "click",
            event => {

                event.preventDefault();


                const id =
                    link.dataset.courseId;


                const course =
                    dashboardCourses.find(
                        item =>
                            String(item.id) ===
                            String(id)
                    );


                if (course) {
                    openCourse(course);
                }
            }
        );
    });
}


/* =====================================================
   COURSE ERROR
===================================================== */

function showCourseError(message) {

    const html =
        `<div class="error-card">
            ${escapeHTML(message)}
        </div>`;


    const recommended =
        $("recommendedCourses");


    const library =
        $("courseLibrary");


    if (recommended) {
        recommended.innerHTML = html;
    }


    if (library) {
        library.innerHTML = html;
    }
}


/* =====================================================
   RECENT COURSE
===================================================== */

function getStoredRecentCourse() {

    try {

        const stored =
            localStorage.getItem(
                "mwanikiLastCourse"
            );


        if (stored) {

            return JSON.parse(stored);
        }

    } catch (error) {

        console.warn(
            "Could not read recent course:",
            error
        );
    }


    const id =
        localStorage.getItem(
            "selectedCourse"
        );


    const title =
        localStorage.getItem(
            "selectedCourseName"
        );


    if (id || title) {

        return {
            id,
            title
        };
    }


    return null;
}


function renderRecentCourse() {

    const container =
        $("recentCourseContent");


    if (!container) {
        return;
    }


    const recent =
        getStoredRecentCourse();


    if (!recent) {

        container.innerHTML =
            `
            <div class="recent-course-placeholder">

                <div class="placeholder-icon">
                    📚
                </div>

                <h3>
                    No recent course yet
                </h3>

                <p>
                    Open a course from your library
                    and it will appear here.
                </p>

                <a
                    href="#coursesSection"
                    class="primary-button"
                >
                    Browse Courses
                </a>

            </div>
            `;

        return;
    }


    const matchingCourse =
        dashboardCourses.find(
            course =>
                String(course.id) ===
                String(recent.id)
        );


    const course =
        matchingCourse || recent;


    const title =
        course.title ||
        "Recent Course";


    const icon =
        getCourseIcon(title);


    container.innerHTML =
        `
        <div class="recent-course-active">

            <div
                class="recent-course-icon"
                style="
                    width:64px;
                    height:64px;
                    display:grid;
                    place-items:center;
                    border-radius:16px;
                    background:#e6f6f8;
                    font-size:30px;
                "
            >
                ${icon}
            </div>

            <h3
                style="
                    margin:15px 0 5px;
                    font-size:20px;
                "
            >
                ${escapeHTML(title)}
            </h3>

            <p
                style="
                    margin:0 0 17px;
                    color:#728589;
                    font-size:12px;
                "
            >
                Continue studying this course from
                where you left off.
            </p>

            <button
                type="button"
                id="continueRecentCourse"
                class="primary-button"
            >
                Continue Learning →
            </button>

        </div>
        `;


    const button =
        $("continueRecentCourse");


    if (button) {

        button.addEventListener(
            "click",
            () => {

                if (matchingCourse) {

                    openCourse(
                        matchingCourse
                    );

                } else {

                    window.location.href =
                        "./course.html";
                }
            }
        );
    }
}


/* =====================================================
   NOTES
===================================================== */

async function loadNotes() {

    const container =
        $("notesLibrary");


    try {

        if (container) {

            container.innerHTML =
                `<div class="loading-card">
                    Loading notes...
                </div>`;
        }


        const {
            data,
            error
        } =
            await supabase
                .from("notes")
                .select("*")
                .eq("published", true)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error) {

            console.error(
                "❌ Notes loading failed:",
                error
            );


            if (container) {

                container.innerHTML =
                    `
                    <div class="error-card">
                        Notes could not be loaded.
                        Please check your Supabase notes
                        RLS policy.
                    </div>
                    `;
            }

            return;
        }


        dashboardNotes =
            Array.isArray(data)
                ? data
                : [];


        setText(
            "totalNotes",
            dashboardNotes.length
        );


        renderNotes();

    } catch (error) {

        console.error(
            "❌ Notes error:",
            error
        );
    }
}


/* =====================================================
   NOTES
===================================================== */

function renderNotes() {

    const container =
        $("notesLibrary");


    if (!container) {
        return;
    }


    if (!dashboardNotes.length) {

        container.innerHTML =
            `
            <div class="loading-card">
                No published notes are available yet.
            </div>
            `;

        return;
    }


    const notes =
        dashboardNotes.slice(0, 9);


    container.innerHTML =
        notes
            .map(note => {

                const title =
                    note.file_name ||
                    note.unit ||
                    "Study Note";


                const course =
                    note.course ||
                    "Medical Studies";


                const unit =
                    note.unit ||
                    "";


                const url =
                    note.file_url;


                return `
                    <article class="note-card">

                        <div class="note-card-top">

                            <div class="note-icon">
                                📝
                            </div>

                            <div>

                                <h3>
                                    ${escapeHTML(title)}
                                </h3>

                                <div class="note-card-course">
                                    ${escapeHTML(course)}
                                </div>

                            </div>

                        </div>


                        <p>
                            ${escapeHTML(
                                unit ||
                                "Published learning resource"
                            )}
                        </p>


                        ${
                            url
                                ? `
                                <a
                                    href="${escapeHTML(url)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="note-button"
                                >
                                    View Note →
                                </a>
                                `
                                : `
                                <button
                                    type="button"
                                    class="note-button"
                                    disabled
                                >
                                    Resource unavailable
                                </button>
                                `
                        }

                    </article>
                `;
            })
            .join("");
}


/* =====================================================
   QUIZZES
===================================================== */

async function loadQuizCount() {

    try {

        const {
            count,
            error
        } =
            await supabase
                .from("quizzes")
                .select(
                    "*",
                    {
                        count: "exact",
                        head: true
                    }
                );


        if (error) {

            console.error(
                "❌ Quiz count failed:",
                error
            );

            return;
        }


        dashboardQuizCount =
            Number(count || 0);


        setText(
            "totalQuizzes",
            dashboardQuizCount
        );


        setText(
            "quizCentreCount",
            dashboardQuizCount
        );

    } catch (error) {

        console.error(
            "❌ Quiz error:",
            error
        );
    }
}


/* =====================================================
   LEARNING PROGRESS
===================================================== */

function loadLearningProgress() {

    let percentage =
        0;


    try {

        const progressRaw =
            localStorage.getItem(
                "mwanikiQuizProgress"
            );


        if (progressRaw) {

            const progress =
                JSON.parse(
                    progressRaw
                );


            if (
                typeof progress ===
                "number"
            ) {

                percentage =
                    Math.max(
                        0,
                        Math.min(
                            100,
                            progress
                        )
                    );

            } else if (
                progress &&
                typeof progress ===
                "object"
            ) {

                const values =
                    Object.values(
                        progress
                    );


                if (values.length) {

                    const completed =
                        values.filter(
                            item =>
                                item?.completed ||
                                item === true
                        ).length;


                    percentage =
                        Math.round(
                            (
                                completed /
                                values.length
                            ) * 100
                        );
                }
            }
        }

    } catch (error) {

        console.warn(
            "Could not read quiz progress:",
            error
        );
    }


    updateLearningProgress(
        percentage
    );
}


function updateLearningProgress(
    percentage
) {

    const safe =
        Math.max(
            0,
            Math.min(
                100,
                Number(percentage) || 0
            )
        );


    setText(
        "learningProgressValue",
        `${safe}%`
    );


    const bar =
        $("learningProgressBar");


    if (bar) {

        bar.style.width =
            `${safe}%`;
    }


    const text =
        $("learningProgressText");


    if (!text) {
        return;
    }


    if (safe >= 90) {

        text.textContent =
            "Excellent progress. Keep going!";

    } else if (safe >= 70) {

        text.textContent =
            "Great progress. You are building strong momentum.";

    } else if (safe >= 40) {

        text.textContent =
            "Good start. Keep working through your courses.";

    } else if (safe > 0) {

        text.textContent =
            "You have started learning. Keep it moving.";

    } else {

        text.textContent =
            "Start learning to build your progress.";
    }
}


/* =====================================================
   CONTINUE LEARNING
===================================================== */

function renderContinueLearning() {

    const container =
        $("continueLearningArea");


    if (!container) {
        return;
    }


    const recentCourse =
        getStoredRecentCourse();


    if (!recentCourse) {

        return;
    }


    const course =
        dashboardCourses.find(
            item =>
                String(item.id) ===
                String(recentCourse.id)
        );


    if (!course) {
        return;
    }


    const title =
        course.title ||
        recentCourse.title ||
        "Recent Course";


    const progress =
        Number(
            localStorage.getItem(
                "mwanikiCourseProgress"
            ) || 0
        );


    const safeProgress =
        Math.max(
            0,
            Math.min(
                100,
                progress
            )
        );


    container.innerHTML =
        `
        <article
            class="continue-course-card"
            style="
                padding:20px;
                border:1px solid #dcebed;
                border-radius:15px;
                background:#ffffff;
                box-shadow:0 12px 35px rgba(18,72,82,0.08);
            "
        >

            <div
                style="
                    display:flex;
                    align-items:center;
                    gap:15px;
                "
            >

                <div
                    style="
                        width:52px;
                        height:52px;
                        display:grid;
                        place-items:center;
                        flex:0 0 52px;
                        border-radius:13px;
                        background:#e6f6f8;
                        font-size:24px;
                    "
                >
                    ${getCourseIcon(title)}
                </div>


                <div
                    style="
                        flex:1;
                    "
                >

                    <span
                        style="
                            display:block;
                            color:#0b7285;
                            font-size:9px;
                            font-weight:900;
                            letter-spacing:1px;
                        "
                    >
                        CONTINUE LEARNING
                    </span>

                    <strong
                        style="
                            display:block;
                            margin-top:4px;
                            font-size:16px;
                        "
                    >
                        ${escapeHTML(title)}
                    </strong>

                </div>


                <button
                    type="button"
                    id="continueLearningButton"
                    class="primary-button"
                >
                    Continue →
                </button>

            </div>


            <div
                style="
                    margin-top:16px;
                    height:7px;
                    overflow:hidden;
                    border-radius:99px;
                    background:#e7eff0;
                "
            >

                <div
                    style="
                        width:${safeProgress}%;
                        height:100%;
                        border-radius:inherit;
                        background:#0b7285;
                    "
                ></div>

            </div>

        </article>
        `;


    const button =
        $("continueLearningButton");


    if (button) {

        button.addEventListener(
            "click",
            () => openCourse(course)
        );
    }
}


/* =====================================================
   NAVIGATION
===================================================== */

function setupNavigation() {

    const links =
        document.querySelectorAll(
            ".dashboard-nav-link"
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
}


/* =====================================================
   NOTIFICATIONS
===================================================== */

function setupNotifications() {

    const button =
        $("notificationButton");

    const panel =
        $("notificationPanel");

    const closeButton =
        $("closeNotificationPanel");


    if (!button || !panel) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            panel.hidden =
                !panel.hidden;


            const profile =
                $("profilePanel");


            if (profile) {
                profile.hidden = true;
            }
        }
    );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            () => {

                panel.hidden = true;
            }
        );
    }
}


/* =====================================================
   PROFILE PANEL
===================================================== */

function setupProfilePanel() {

    const button =
        $("profileButton");

    const panel =
        $("profilePanel");

    const closeButton =
        $("closeProfilePanel");


    if (!button || !panel) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            panel.hidden =
                !panel.hidden;


            const notificationPanel =
                $("notificationPanel");


            if (notificationPanel) {

                notificationPanel.hidden =
                    true;
            }
        }
    );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            () => {

                panel.hidden = true;
            }
        );
    }
}


/* =====================================================
   LOGOUT
===================================================== */

function setupLogout() {

    const button =
        $("logoutButton");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        async () => {

            button.disabled = true;

            button.textContent =
                "Logging out...";


            const {
                error
            } =
                await supabase.auth.signOut();


            if (error) {

                console.error(
                    "❌ Logout failed:",
                    error
                );


                button.disabled = false;

                button.textContent =
                    "Log Out";

                return;
            }


            localStorage.removeItem(
                "selectedCourse"
            );

            localStorage.removeItem(
                "selectedCourseName"
            );

            localStorage.removeItem(
                "selectedUnit"
            );

            localStorage.removeItem(
                "selectedUnitTitle"
            );

            localStorage.removeItem(
                "mwanikiLastCourse"
            );


            window.location.href =
                "./index.html";
        }
    );
}


/* =====================================================
   REFRESH BUTTONS
===================================================== */

function setupRefreshButtons() {

    const coursesButton =
        $("refreshCoursesButton");


    if (coursesButton) {

        coursesButton.addEventListener(
            "click",
            async () => {

                coursesButton.disabled =
                    true;

                coursesButton.textContent =
                    "Refreshing...";


                await loadCourses();


                coursesButton.disabled =
                    false;

                coursesButton.textContent =
                    "↻ Refresh";
            }
        );
    }


    const notesButton =
        $("refreshNotesButton");


    if (notesButton) {

        notesButton.addEventListener(
            "click",
            async () => {

                notesButton.disabled =
                    true;

                notesButton.textContent =
                    "Refreshing...";


                await loadNotes();


                notesButton.disabled =
                    false;

                notesButton.textContent =
                    "↻ Refresh";
            }
        );
    }
}


/* =====================================================
   TRACK COURSE
===================================================== */

window.mwanikiTrackUnit =
    function (
        courseId,
        courseTitle,
        unitId,
        unitTitle
    ) {

        localStorage.setItem(
            "selectedCourse",
            String(courseId)
        );


        localStorage.setItem(
            "selectedCourseName",
            courseTitle || ""
        );


        localStorage.setItem(
            "selectedUnit",
            String(unitId)
        );


        localStorage.setItem(
            "selectedUnitTitle",
            unitTitle || ""
        );


        localStorage.setItem(
            "mwanikiLastCourse",
            JSON.stringify({
                id: courseId,
                title: courseTitle || "",
                unitId: unitId,
                unitTitle: unitTitle || "",
                openedAt:
                    new Date().toISOString()
            })
        );
    };


/* =====================================================
   PUBLIC DASHBOARD API
===================================================== */

window.mwanikiDashboard = {

    refreshCourses:
        loadCourses,

    refreshNotes:
        loadNotes,

    refreshQuizCount:
        loadQuizCount,

    refreshProgress:
        loadLearningProgress,

    getCourses:
        () => dashboardCourses,

    getNotes:
        () => dashboardNotes

};


/* =====================================================
   INITIALIZE
===================================================== */

async function initializeDashboard() {

    console.log(
        "🚀 Initializing Mwaniki Scholars dashboard..."
    );


    setupCurrentDate();


    const user =
        await loadCurrentUser();


    if (!user) {

        console.warn(
            "⚠️ No authenticated user found."
        );


        setText(
            "welcomeMessage",
            "Welcome to Mwaniki Scholars 👋"
        );

    } else {

        await loadStudentProfile();
    }


    await Promise.all([
        loadCourses(),
        loadNotes(),
        loadQuizCount()
    ]);


    loadLearningProgress();

    renderContinueLearning();


    setupNavigation();

    setupNotifications();

    setupProfilePanel();

    setupLogout();

    setupRefreshButtons();


    console.log(
        "✅ Mwaniki Scholars dashboard ready."
    );
}


/* =====================================================
   START
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    initializeDashboard
);
