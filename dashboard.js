import { supabase } from "./supabase.js";


// =====================================================
// MWANIKI SCHOLARS
// STUDENT DASHBOARD ENGINE
// =====================================================

console.log("🚀 Mwaniki Scholars Student Dashboard starting...");


// =====================================================
// STATE
// =====================================================

let currentUser = null;
let currentStudent = null;

let dashboardCourses = [];
let dashboardNotes = [];
let dashboardQuizCount = 0;


// =====================================================
// DOM HELPER
// =====================================================

function $(id) {
    return document.getElementById(id);
}


// =====================================================
// SAFE TEXT
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
// DATE FORMATTER
// =====================================================

function formatDate(dateValue) {

    if (!dateValue) {
        return "";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}


// =====================================================
// SET TEXT SAFELY
// =====================================================

function setText(id, value) {

    const element = $(id);

    if (!element) {
        return;
    }

    element.textContent = value;
}


// =====================================================
// SHOW / HIDE
// =====================================================

function showElement(id) {

    const element = $(id);

    if (!element) {
        return;
    }

    element.hidden = false;
}


function hideElement(id) {

    const element = $(id);

    if (!element) {
        return;
    }

    element.hidden = true;
}


// =====================================================
// AUTHENTICATED USER
// =====================================================

async function loadCurrentUser() {

    console.log("🔐 Checking student authentication...");

    const {
        data,
        error
    } = await supabase.auth.getUser();

    if (error) {

        console.error(
            "❌ Supabase authentication error:",
            error
        );

        return null;
    }

    if (!data || !data.user) {

        console.warn(
            "⚠️ No authenticated user found."
        );

        return null;
    }

    currentUser = data.user;

    console.log(
        "✅ Authenticated user:",
        currentUser.email
    );

    return currentUser;
}


// =====================================================
// STUDENT PROFILE
// =====================================================

async function loadStudentProfile() {

    if (!currentUser) {
        return;
    }

    console.log(
        "👤 Loading student profile..."
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

        console.warn(
            "⚠️ Student profile lookup:",
            error
        );

        applyBasicUserProfile();

        return;
    }


    if (!data) {

        console.warn(
            "⚠️ No student profile row found."
        );

        applyBasicUserProfile();

        return;
    }


    currentStudent = data;

    const studentName =
        data.full_name ||
        data.name ||
        data.student_name ||
        data.username ||
        currentUser.email?.split("@")[0] ||
        "Student";


    updateStudentIdentity(
        studentName,
        currentUser.email
    );
}


// =====================================================
// BASIC USER PROFILE FALLBACK
// =====================================================

function applyBasicUserProfile() {

    if (!currentUser) {
        return;
    }

    const fallbackName =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        currentUser.email?.split("@")[0] ||
        "Student";


    updateStudentIdentity(
        fallbackName,
        currentUser.email
    );
}


// =====================================================
// UPDATE STUDENT IDENTITY
// =====================================================

function updateStudentIdentity(
    name,
    email
) {

    const cleanName =
        name ||
        "Student";


    const firstLetter =
        cleanName
            .trim()
            .charAt(0)
            .toUpperCase() ||
        "S";


    setText(
        "welcomeMessage",
        `Welcome back, ${cleanName}`
    );


    setText(
        "profileName",
        cleanName
    );


    setText(
        "profileInitial",
        firstLetter
    );


    setText(
        "profilePanelName",
        cleanName
    );


    setText(
        "profilePanelEmail",
        email || "Not available"
    );
}


// =====================================================
// LOAD COURSES
// =====================================================

async function loadCourses() {

    const loading = $("coursesLoading");
    const errorBox = $("coursesError");
    const container = $("coursesContainer");


    if (loading) {
        loading.hidden = false;
    }

    if (errorBox) {
        errorBox.hidden = true;
        errorBox.textContent = "";
    }

    if (container) {
        container.innerHTML = "";
    }


    console.log(
        "📚 Requesting courses from Supabase..."
    );


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

        console.error(
            "❌ COURSES SUPABASE ERROR:",
            error
        );


        if (loading) {
            loading.hidden = true;
        }


        if (errorBox) {

            errorBox.hidden = false;

            errorBox.textContent =
                `Unable to load courses: ${error.message}`;
        }


        setText(
            "totalCourses",
            "0"
        );

        return;
    }


    dashboardCourses =
        Array.isArray(data)
            ? data
            : [];


    console.log(
        `✅ Courses returned from Supabase: ${dashboardCourses.length}`
    );


    if (loading) {
        loading.hidden = true;
    }


    setText(
        "totalCourses",
        dashboardCourses.length
    );


    renderCourses();
}


// =====================================================
// RENDER COURSES
// =====================================================

function renderCourses() {

    const container =
        $("coursesContainer");


    if (!container) {
        console.error(
            "❌ coursesContainer not found."
        );
        return;
    }


    if (!dashboardCourses.length) {

        container.innerHTML = `
            <div class="empty-message">
                No courses are currently available.
            </div>
        `;

        return;
    }


    container.innerHTML =
        dashboardCourses
            .map(
                (course) => {

                    const id =
                        course.id;

                    const title =
                        course.title ||
                        "Untitled Course";

                    const description =
                        course.description ||
                        "Medical learning course available through Mwaniki Scholars.";

                    const image =
                        course.image ||
                        "";


                    return `
                        <article
                            class="course-card"
                            data-course-id="${escapeHTML(id)}"
                        >

                            ${
                                image
                                    ? `
                                        <div class="course-card-image">
                                            <img
                                                src="${escapeHTML(image)}"
                                                alt="${escapeHTML(title)}"
                                                loading="lazy"
                                                onerror="this.style.display='none';"
                                            >
                                        </div>
                                      `
                                    : `
                                        <div
                                            class="course-card-image course-placeholder"
                                            aria-hidden="true"
                                        >
                                            📚
                                        </div>
                                      `
                            }


                            <div class="course-card-content">

                                <h3>
                                    ${escapeHTML(title)}
                                </h3>

                                <p>
                                    ${escapeHTML(description)}
                                </p>


                                <button
                                    type="button"
                                    class="primary-action-button course-open-button"
                                    data-course-id="${escapeHTML(id)}"
                                    data-course-title="${escapeHTML(title)}"
                                >
                                    Open Course
                                </button>

                            </div>

                        </article>
                    `;
                }
            )
            .join("");


    container
        .querySelectorAll(".course-open-button")
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        const courseId =
                            button.dataset.courseId;

                        const courseTitle =
                            button.dataset.courseTitle;


                        openCourse(
                            courseId,
                            courseTitle
                        );
                    }
                );
            }
        );
}


// =====================================================
// OPEN COURSE
// =====================================================

function openCourse(
    courseId,
    courseTitle
) {

    if (!courseId) {

        console.error(
            "❌ Course ID missing."
        );

        return;
    }


    console.log(
        "📖 Opening course:",
        courseId,
        courseTitle
    );


    localStorage.setItem(
        "selectedCourse",
        String(courseId)
    );


    localStorage.setItem(
        "selectedCourseName",
        courseTitle || ""
    );


    window.location.href =
        `./course.html?course_id=${encodeURIComponent(courseId)}`;
}


// =====================================================
// LOAD NOTES
// =====================================================

async function loadNotes() {

    const loading =
        $("notesLoading");

    const errorBox =
        $("notesError");

    const emptyBox =
        $("notesEmpty");

    const container =
        $("notesContainer");


    if (loading) {
        loading.hidden = false;
    }

    if (errorBox) {
        errorBox.hidden = true;
        errorBox.textContent = "";
    }

    if (emptyBox) {
        emptyBox.hidden = true;
    }

    if (container) {
        container.innerHTML = "";
    }


    console.log(
        "📝 Requesting published notes from Supabase..."
    );


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

        console.error(
            "❌ NOTES SUPABASE ERROR:",
            error
        );


        if (loading) {
            loading.hidden = true;
        }


        if (errorBox) {

            errorBox.hidden = false;

            errorBox.textContent =
                `Unable to load notes: ${error.message}`;
        }


        setText(
            "totalNotes",
            "0"
        );

        return;
    }


    dashboardNotes =
        Array.isArray(data)
            ? data
            : [];


    console.log(
        `✅ Published notes returned: ${dashboardNotes.length}`
    );


    if (loading) {
        loading.hidden = true;
    }


    setText(
        "totalNotes",
        dashboardNotes.length
    );


    renderNotes();
}


// =====================================================
// RENDER NOTES
// =====================================================

function renderNotes() {

    const container =
        $("notesContainer");

    const emptyBox =
        $("notesEmpty");


    if (!container) {

        console.error(
            "❌ notesContainer not found."
        );

        return;
    }


    if (!dashboardNotes.length) {

        container.innerHTML = "";


        if (emptyBox) {
            emptyBox.hidden = false;
        }

        return;
    }


    if (emptyBox) {
        emptyBox.hidden = true;
    }


    container.innerHTML =
        dashboardNotes
            .map(
                (note) => {

                    const title =
                        note.file_name ||
                        note.title ||
                        "Medical Study Note";


                    const course =
                        note.course ||
                        note.course_name ||
                        "Medical Learning";


                    const unit =
                        note.unit ||
                        note.unit_name ||
                        "";


                    const fileUrl =
                        note.file_url ||
                        "#";


                    return `
                        <article class="note-card">

                            <div
                                class="note-card-icon"
                                aria-hidden="true"
                            >
                                📝
                            </div>


                            <div class="note-card-content">

                                <h3>
                                    ${escapeHTML(title)}
                                </h3>


                                <p>
                                    ${escapeHTML(course)}
                                    ${
                                        unit
                                            ? ` · ${escapeHTML(unit)}`
                                            : ""
                                    }
                                </p>


                                <p class="note-date">
                                    ${
                                        formatDate(
                                            note.created_at
                                        )
                                    }
                                </p>


                                ${
                                    fileUrl !== "#"
                                        ? `
                                            <a
                                                href="${escapeHTML(fileUrl)}"
                                                class="primary-action-button"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Open Note
                                            </a>
                                          `
                                        : `
                                            <span class="empty-message">
                                                Note file unavailable.
                                            </span>
                                          `
                                }

                            </div>

                        </article>
                    `;
                }
            )
            .join("");
}


// =====================================================
// LOAD QUIZ COUNT
// =====================================================

async function loadQuizCount() {

    console.log(
        "🧠 Requesting quiz count from Supabase..."
    );


    const {
        count,
        error
    } = await supabase
        .from("quizzes")
        .select("id", {
            count: "exact",
            head: true
        });


    if (error) {

        console.error(
            "❌ QUIZ COUNT SUPABASE ERROR:",
            error
        );


        setText(
            "totalQuizzes",
            "0"
        );

        dashboardQuizCount = 0;

        return;
    }


    dashboardQuizCount =
        Number(count || 0);


    setText(
        "totalQuizzes",
        dashboardQuizCount
    );


    console.log(
        `✅ Quiz count: ${dashboardQuizCount}`
    );
}


// =====================================================
// LEARNING PROGRESS
// =====================================================

function loadLearningProgress() {

    let completed = 0;

    let total =
        dashboardCourses.length;


    try {

        const stored =
            localStorage.getItem(
                "mwanikiQuizProgress"
            );


        if (stored) {

            const parsed =
                JSON.parse(stored);


            if (
                parsed &&
                typeof parsed === "object"
            ) {

                completed =
                    Object.values(parsed)
                        .filter(
                            (value) =>
                                value === true ||
                                value === "completed" ||
                                value?.completed === true
                        )
                        .length;
            }
        }

    } catch (error) {

        console.warn(
            "⚠️ Could not read learning progress:",
            error
        );
    }


    if (!total) {

        setText(
            "learningProgress",
            "0%"
        );

        return;
    }


    const percentage =
        Math.min(
            100,
            Math.round(
                (completed / total) * 100
            )
        );


    setText(
        "learningProgress",
        `${percentage}%`
    );
}


// =====================================================
// REFRESH COURSES
// =====================================================

function setupCourseRefresh() {

    const button =
        $("refreshCoursesButton");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        async () => {

            button.disabled = true;

            button.textContent =
                "Refreshing...";


            try {

                await loadCourses();

            } finally {

                button.disabled = false;

                button.textContent =
                    "Refresh";
            }
        }
    );
}


// =====================================================
// REFRESH NOTES
// =====================================================

function setupNotesRefresh() {

    const button =
        $("refreshNotesButton");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        async () => {

            button.disabled = true;

            button.textContent =
                "Refreshing...";


            try {

                await loadNotes();

            } finally {

                button.disabled = false;

                button.textContent =
                    "Refresh";
            }
        }
    );
}


// =====================================================
// DASHBOARD NAVIGATION
// =====================================================

function setupNavigation() {

    const links =
        document.querySelectorAll(
            ".dashboard-nav-link"
        );


    links.forEach(
        (link) => {

            link.addEventListener(
                "click",
                () => {

                    links.forEach(
                        (item) => {
                            item.classList.remove(
                                "active"
                            );
                        }
                    );


                    link.classList.add(
                        "active"
                    );
                }
            );
        }
    );
}


// =====================================================
// NOTIFICATION PANEL
// =====================================================

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


// =====================================================
// PROFILE PANEL
// =====================================================

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


// =====================================================
// LOGOUT
// =====================================================

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
            } = await supabase.auth.signOut();


            if (error) {

                console.error(
                    "❌ Logout error:",
                    error
                );


                alert(
                    `Unable to log out: ${error.message}`
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

            window.location.href =
                "./index.html";
        }
    );
}


// =====================================================
// STUDENT-ONLY TUTOR BOOKING
// =====================================================

function setupStudentTutorBooking() {

    /*
     * IMPORTANT SECURITY RULE:
     *
     * NEVER send students to:
     *
     * ./tutor.html
     *
     * tutor.html is the tutor dashboard.
     *
     * Students are sent to:
     *
     * ./studentTutor.html
     *
     * which is intended to be the student-facing
     * tutor booking interface.
     */


    const bookingLink =
        document.querySelector(
            '#tutorBookingContainer a[href="./studentTutor.html"]'
        );


    if (!bookingLink) {
        return;
    }


    bookingLink.addEventListener(
        "click",
        async (event) => {

            /*
             * Do not allow an unauthenticated
             * student to enter the booking area.
             */

            if (!currentUser) {

                event.preventDefault();


                alert(
                    "Please log in as a student before booking a tutor."
                );


                window.location.href =
                    "./index.html";
            }
        }
    );
}


// =====================================================
// GLOBAL COURSE TRACKING
// =====================================================

window.mwanikiTrackUnit =
    function (
        courseId,
        unitId,
        unitTitle
    ) {

        try {

            const key =
                "mwanikiRecentActivity";


            const existing =
                JSON.parse(
                    localStorage.getItem(key) ||
                    "[]"
                );


            const activity = {

                courseId:
                    String(courseId || ""),

                unitId:
                    String(unitId || ""),

                unitTitle:
                    unitTitle || "",

                timestamp:
                    new Date().toISOString()
            };


            const filtered =
                existing.filter(
                    (item) =>
                        !(
                            String(item.courseId) ===
                            String(courseId) &&
                            String(item.unitId) ===
                            String(unitId)
                        )
                );


            filtered.unshift(
                activity
            );


            localStorage.setItem(
                key,
                JSON.stringify(
                    filtered.slice(0, 20)
                )
            );

        } catch (error) {

            console.warn(
                "⚠️ Unable to track unit:",
                error
            );
        }
    };


// =====================================================
// GLOBAL DASHBOARD API
// =====================================================

window.mwanikiDashboard = {

    refreshCourses:
        loadCourses,

    refreshNotes:
        loadNotes,

    refreshQuizCount:
        loadQuizCount,

    refreshProgress:
        loadLearningProgress
};


// =====================================================
// INITIALIZE DASHBOARD
// =====================================================

async function initializeDashboard() {

    console.log(
        "🚀 Initializing Mwaniki Scholars dashboard..."
    );


    /*
     * Authentication is checked first.
     */

    const user =
        await loadCurrentUser();


    /*
     * If there is no authenticated student,
     * do not continue pretending that the
     * dashboard is loaded normally.
     */

    if (!user) {

        console.warn(
            "⚠️ Student is not authenticated."
        );

        setText(
            "welcomeMessage",
            "Welcome to Mwaniki Scholars"
        );

    } else {

        await loadStudentProfile();
    }


    /*
     * Load the actual dashboard data.
     */

    await Promise.all([
        loadCourses(),
        loadNotes(),
        loadQuizCount()
    ]);


    loadLearningProgress();


    /*
     * Interface controls.
     */

    setupCourseRefresh();

    setupNotesRefresh();

    setupNavigation();

    setupNotifications();

    setupProfilePanel();

    setupLogout();

    setupStudentTutorBooking();


    console.log(
        "✅ Mwaniki Scholars dashboard ready."
    );
}


// =====================================================
// START
// =====================================================

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard
    );

} else {

    initializeDashboard();
}
